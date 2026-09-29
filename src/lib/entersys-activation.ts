/**
 * EnterSYS Platform - Fluxa Integration Module & Licensing Engine
 * Upravljanje licencama, paketima, kontekstima i kalkulaciji troškova za EnterSYS tenante.
 */

export type EnterSysTier = "BASIC" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";

export type EnterSysContext = 
  | "bazen" 
  | "event" 
  | "dvorana" 
  | "teretana" 
  | "plaza" 
  | "igraonica";

export type EnterSysBillingMode = "MONTHLY_SAAS" | "SEASONAL" | "EVENT_PRESALE_FIXED";

/** Mjesečni osnovni paket (cjenovnik) — nije SOCCS BASIC/ENTERPRISE. */
export const ENTERSYS_BASE_PACKAGES = [
  {
    id: "ENTER_ARGUS",
    label: "Enter + Argus (Osnovni prolazi i tripodi)",
    priceKm: 100,
    managerModule: "enterCore" as const,
    context: null as EnterSysContext | null,
  },
  {
    id: "POOL_MANAGER",
    label: "PoolManager (Bazen / Vodeni park)",
    priceKm: 200,
    managerModule: "poolManager" as const,
    context: "bazen" as EnterSysContext,
  },
  {
    id: "HALL_MANAGER",
    label: "HallManager (Sportska dvorana / Balon)",
    priceKm: 200,
    managerModule: "hallManager" as const,
    context: "dvorana" as EnterSysContext,
  },
  {
    id: "FIELD_MANAGER",
    label: "FieldManager (Otvoreni tereni / Plaže)",
    priceKm: 200,
    managerModule: "fieldManager" as const,
    context: "plaza" as EnterSysContext,
  },
  {
    id: "GYM_MANAGER",
    label: "GymManager (Fitness centar / Teretana)",
    priceKm: 200,
    managerModule: "gymManager" as const,
    context: "teretana" as EnterSysContext,
  },
  {
    id: "EVENT_MANAGER",
    label: "EventManager (Događaji, Utakmice & Koncerti)",
    priceKm: 300,
    managerModule: "eventManager" as const,
    context: "event" as EnterSysContext,
  },
  {
    id: "ENTERSYS_FULL",
    label: "EnterSYS Full Resort & Arena (Sveobuhvatni paket)",
    priceKm: 450,
    managerModule: "enterCore" as const,
    context: "bazen" as EnterSysContext,
  },
] as const;

export type EnterSysBasePackageId = (typeof ENTERSYS_BASE_PACKAGES)[number]["id"];

export const ENTERSYS_MODULE_KEYS = [
  // 1. Hardver & Prolazi
  { key: "enterCore", label: "ENTER Master Kontroler (ARGUS tripodi, kapije, rampe)", category: "HARDWARE", icon: "🚪" },
  { key: "fluxaPos", label: "FluxaPOS Blagajna (Fiskalna touch kasa i biletarnica)", category: "HARDWARE", icon: "💳" },
  { key: "doorMan", label: "DoorMan (Čitači na vratima, RFID kontrola prolaza)", category: "HARDWARE", icon: "🔑" },
  { key: "lockers", label: "Locker (Pametni RS-485 ormarići & narukvice)", category: "HARDWARE", icon: "🔒" },
  { key: "cctvGate", label: "CCTV Gate (Video nadzor, LPR tablice i evidencija prolaza)", category: "HARDWARE", icon: "📹" },

  // 2. Menadžeri Objekata
  { key: "poolManager", label: "PoolManager (Bazeni, staze, ležaljke, dnevni/sezonski posjetioci)", category: "MANAGERS", icon: "🏊" },
  { key: "hallManager", label: "HallManager (Sportske dvorane, raspored i rezervacije termina)", category: "MANAGERS", icon: "🏟️" },
  { key: "fieldManager", label: "FieldManager (Sportski tereni, fudbal/tenis, plaže)", category: "MANAGERS", icon: "⚽" },
  { key: "gymManager", label: "GymManager (Teretane, evidencija članova, treninzi i članarine)", category: "MANAGERS", icon: "🏋️" },
  { key: "rentals", label: "Rentals (Iznajmljivanje opreme, ležaljki, rekvizita, plovila)", category: "MANAGERS", icon: "🏖️" },
  { key: "eventManager", label: "EventManager (Ulaznice za koncerte, utakmice, bar-kodovi)", category: "MANAGERS", icon: "🎫" },
  { key: "webShop", label: "WebShop (Online prodaja i dopuna karata/članarina)", category: "MANAGERS", icon: "🛒" },

  // 3. Mediji & Info Displeji
  { key: "mojRadio", label: "MojRadio (Interni radio streaming po zvučnim zonama)", category: "MEDIA", icon: "📻" },
  { key: "mojTv", label: "MojTV (Smart TV info displeji, rasporedi, digital signage)", category: "MEDIA", icon: "📺" },
] as const;

const MANAGER_MODULE_KEYS = [
  "poolManager",
  "hallManager",
  "fieldManager",
  "gymManager",
  "eventManager",
] as const;

export function isEnterSysBasePackageId(
  raw: string,
): raw is EnterSysBasePackageId {
  return ENTERSYS_BASE_PACKAGES.some((p) => p.id === raw);
}

export function getEnterSysBasePackage(id: string | null | undefined) {
  const raw = String(id ?? "")
    .trim()
    .toUpperCase();
  return ENTERSYS_BASE_PACKAGES.find((p) => p.id === raw) ?? null;
}

/** Iz sačuvanog paketa ili iz uključenih modula (stari tenanti bez upisanog paketa). */
export function resolveEnterSysBasePackageId(input: {
  soccs_tier?: string | null;
  soccs_platform_scope?: string | null;
}): EnterSysBasePackageId | null {
  const saved = getEnterSysBasePackage(input.soccs_tier);
  if (saved) return saved.id;
  const scope = String(input.soccs_platform_scope ?? "");
  const active = scope ? scope.split(",").map((s) => s.trim()) : [];
  if (active.includes("poolManager")) return "POOL_MANAGER";
  if (active.includes("hallManager")) return "HALL_MANAGER";
  if (active.includes("fieldManager")) return "FIELD_MANAGER";
  if (active.includes("gymManager")) return "GYM_MANAGER";
  if (active.includes("eventManager")) return "EVENT_MANAGER";
  if (active.includes("enterCore") || active.length === 0) return "ENTER_ARGUS";
  return null;
}

export function applyEnterSysPackageToModules(
  packageId: EnterSysBasePackageId,
  current: Record<string, boolean>,
): Record<string, boolean> {
  const pkg = getEnterSysBasePackage(packageId);
  const next = { ...current, enterCore: true };
  for (const key of MANAGER_MODULE_KEYS) {
    next[key] = pkg?.managerModule === key;
  }
  return next;
}

/**
 * Zvanični Cjenovnik EnterSYS Modula (u KM):
 * - Mjesečne pretplate
 * - EventManager paket: 300 KM/dan (uključuje i MojRadio i MojTV)
 * - Dan pretprodaje EventManager-a: 5% od dnevne cijene = 15 KM/dan
 */
export const ENTERSYS_PRICE_LIST_KM = {
  ENTER_ARGUS_BASE: 100,         // Enter + Argus (Mjesečno)
  POOL_MANAGER: 200,             // PoolManager, Enter + Argus (Mjesečno)
  HALL_MANAGER: 200,             // HallManager, Enter + Argus (Mjesečno)
  FIELD_MANAGER: 200,            // FieldManager, Enter + Argus (Mjesečno)
  GYM_MANAGER: 200,              // GymManager, Enter + Argus (Mjesečno)
  DOOR_MAN: 80,                  // DoorMan (Mjesečno)
  EVENT_MANAGER_DAY: 300,        // EventManager, Enter + Argus (Po danu događaja - uključuje MojRadio & MojTV)
  EVENT_MANAGER_PRESALE_DAY: 15, // Pretprodaja (5% od dnevne cijene: 15 KM/dan)
  LOCKER: 80,                    // Locker (Mjesečno)
  RENTALS: 80,                   // Rentals (Mjesečno)
  MOJ_RADIO: 100,                // MojRadio (Mjesečno)
  MOJ_TV: 200,                   // MojTV (Mjesečno)
  CCTV_GATE: 150,                // CCTV Gate Video Nadzor & Evidencija Prolaza (Mjesečno) — NOVI MODUL!
  WEB_SHOP: 30,                  // WebShop (Mjesečno)
} as const;

export interface EnterSysLicenceConfig {
  tenantId: string;
  tenantName: string;
  context: EnterSysContext;
  tier: EnterSysTier;
  billingMode: EnterSysBillingMode;
  presaleDailyRateKm?: number;
  eventDailyRateKm?: number;
  modules: {
    enterCore: boolean;
    poolManager: boolean;
    hallManager: boolean;
    fieldManager: boolean;
    gymManager: boolean;
    doorMan: boolean;
    eventManager: boolean;
    rentals: boolean;
    lockers: boolean;
    mojRadio: boolean;
    mojTv: boolean;
    cctvGate: boolean;
    webShop: boolean;
    b2bPortal: boolean;
  };
}

/**
 * Kalkulacija cene za utakmice, koncerte i događaje (EventManager model):
 * Pretprodaja 15 KM/dan (5% od dnevne cene) + Glavni dan događaja 300 KM/dan (uključuje MojRadio i MojTV).
 */
export function calculateEventLicenceFeeKm(input: {
  presaleDays: number;
  eventDays: number;
}) {
  const eventDayRate = ENTERSYS_PRICE_LIST_KM.EVENT_MANAGER_DAY;       // 300 KM
  const presaleRate = ENTERSYS_PRICE_LIST_KM.EVENT_MANAGER_PRESALE_DAY; // 15 KM (5% od 300 KM)

  const presaleTotal = input.presaleDays * presaleRate;
  const eventTotal = input.eventDays * eventDayRate;
  const grandTotal = presaleTotal + eventTotal;

  return {
    eventDays: input.eventDays,
    eventRateKm: eventDayRate,
    eventTotalKm: eventTotal,
    presaleDays: input.presaleDays,
    presaleRateKm: presaleRate,
    presaleTotalKm: presaleTotal,
    grandTotalKm: grandTotal,
    includesMojRadioAndTv: true,
  };
}

/**
 * Podrazumevana matrica modula po paketima (koja se može prilagoditi po želji tenanta).
 */
export function defaultModulesForTierAndContext(
  tier: EnterSysTier,
  context: EnterSysContext
): EnterSysLicenceConfig["modules"] {
  return {
    enterCore: true,
    poolManager: context === "bazen",
    hallManager: context === "dvorana",
    fieldManager: context === "plaza" || context === "bazen",
    gymManager: context === "teretana",
    doorMan: true,
    eventManager: context === "event" || context === "dvorana",
    rentals: context === "plaza" || context === "bazen",
    lockers: context === "teretana" || context === "bazen" || context === "dvorana",
    mojRadio: context === "event" || tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    mojTv: context === "event" || tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    cctvGate: tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    webShop: tier === "ENTERPRISE",
    b2bPortal: tier === "ENTERPRISE",
  };
}
