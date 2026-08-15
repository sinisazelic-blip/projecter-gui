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
    eventManager: context === "event" || context === "dvorana",
    rentals: context === "plaza" || context === "bazen",
    lockers: context === "teretana" || context === "bazen" || context === "dvorana",
    mojRadio: context === "event" || tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    mojTv: context === "event" || tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    b2bPortal: tier === "ENTERPRISE",
  };
}
