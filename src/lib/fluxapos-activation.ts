/**
 * FluxaPOS Platform - Studio Integration Module & Licensing Engine
 * Upravljanje licencama, paketima, brojem kasa i dinamičkoj kalkulaciji troškova za FluxaPOS tenante.
 */

export const FLUXAPOS_BASE_PACKAGES = [
  {
    id: "FLUXAPOS_START",
    label: "FluxaPOS Start (Caffe & Trgovina)",
    priceKm: 50,
    priceEur: 25,
    maxKasa: 1,
    description: "Samostalna kasa sa fiskalizacijom, svim smjenskim izvještajima i internom KUF analitikom marže",
  },
  {
    id: "FLUXAPOS_PRO",
    label: "FluxaPOS Pro (Ugostiteljstvo, Restorani & QSR)",
    priceKm: 80,
    priceEur: 40,
    maxKasa: 3,
    description: "Kompletan paket sa Džepnim konobarom, Kuhinjskim displejem (KDS), Redomat TV prozivkom i Floor builderom",
  },
  {
    id: "FLUXAPOS_ENTERPRISE",
    label: "FluxaPOS Enterprise & Arena (Bazen, Biletarnica & ERP)",
    priceKm: 130,
    priceEur: 65,
    maxKasa: 10,
    description: "Sveobuhvatni paket sa EnterSYS biletarnicom, TicketMan mobilnom kontrolom ulaza, RFID depozitima i Pantheon ERP-om",
  },
] as const;

export type FluxaPosBasePackageId = (typeof FLUXAPOS_BASE_PACKAGES)[number]["id"];

export interface FluxaPosModuleDefinition {
  key: string;
  label: string;
  shortDesc: string;
  category: "CORE" | "HORECA" | "TICKETING" | "ENTERPRISE";
  categoryLabel: string;
  icon: string;
  priceKm: number;
  priceEur: number;
  isCore?: boolean;
}

export const FLUXAPOS_MODULE_KEYS: FluxaPosModuleDefinition[] = [
  // 1. Osnovne Funkcije (Uključeno u sve pakete - 0 KM doplata)
  {
    key: "posCore",
    label: "FluxaPOS Glavna Kasa",
    shortDesc: "Touch interfejs, stolovi, fiskalizacija",
    category: "CORE",
    categoryLabel: "📋 Osnovne Funkcije",
    icon: "💻",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "shiftEmail",
    label: "Svi Izvještaji (PDF/Email/Viber)",
    shortDesc: "Z-obračun, smjene, slanje na email/Viber",
    category: "CORE",
    categoryLabel: "📋 Osnovne Funkcije",
    icon: "📊",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "kufAnalytics",
    label: "KUF & Analitika Marže",
    shortDesc: "Knjiga ulaznih faktura i praćenje troškova",
    category: "CORE",
    categoryLabel: "📋 Osnovne Funkcije",
    icon: "📋",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },

  // 2. Ugostiteljstvo & Prozivka (HORECA Add-ons)
  {
    key: "pocketWaiter",
    label: "Džepni Konobar (Mobilni)",
    shortDesc: "Kucanje narudžbi sa telefona na stolovima",
    category: "HORECA",
    categoryLabel: "🍽️ Ugostiteljstvo & Prozivka",
    icon: "📱",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "kdsKitchen",
    label: "Kuhinjski Displej (KDS)",
    shortDesc: "Digitalni ekran za kuvare i šankere",
    category: "HORECA",
    categoryLabel: "🍽️ Ugostiteljstvo & Prozivka",
    icon: "👨‍🍳",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "redomat",
    label: "Fluxa Redomat (Smart TV + AI)",
    shortDesc: "TV prozivka narudžbi i Azure AI glas",
    category: "HORECA",
    categoryLabel: "🍽️ Ugostiteljstvo & Prozivka",
    icon: "📺",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "floorBuilder",
    label: "Interaktivni Floor Builder",
    shortDesc: "Drag-and-drop dizajner sala i terasa",
    category: "HORECA",
    categoryLabel: "🍽️ Ugostiteljstvo & Prozivka",
    icon: "📐",
    priceKm: 10,
    priceEur: 5,
  },

  // 3. Biletarnica, Eventi & Kontrola Ulaza
  {
    key: "enterTicketing",
    label: "EnterSYS Biletarnica",
    shortDesc: "Paketne karte (10/20/30), roditeljski nadzor",
    category: "TICKETING",
    categoryLabel: "🎟️ Biletarnica & Eventi",
    icon: "🏊",
    priceKm: 30,
    priceEur: 15,
  },
  {
    key: "ticketMan",
    label: "TicketMan / DoorMan",
    shortDesc: "Validacija ulaznica kamerom telefona/tableta",
    category: "TICKETING",
    categoryLabel: "🎟️ Biletarnica & Eventi",
    icon: "🎫",
    priceKm: 20,
    priceEur: 10,
  },
  {
    key: "rfidDeposit",
    label: "RFID Porodični Depozit",
    shortDesc: "Bezgotovinsko plaćanje narukvicama",
    category: "TICKETING",
    categoryLabel: "🎟️ Biletarnica & Eventi",
    icon: "🪪",
    priceKm: 15,
    priceEur: 8,
  },

  // 4. Uprava & Integracije
  {
    key: "upravaCloud",
    label: "Uprava Live Telemetrija",
    shortDesc: "Uživo Cloud nadzor prometa i stanja fioke",
    category: "ENTERPRISE",
    categoryLabel: "🏢 Uprava & Integracije",
    icon: "🏢",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "pantheonSync",
    label: "Pantheon ERP Sinhronizacija",
    shortDesc: "Dvostrani prenos sa Datalab Pantheon-om",
    category: "ENTERPRISE",
    categoryLabel: "🏢 Uprava & Integracije",
    icon: "🏛️",
    priceKm: 25,
    priceEur: 12,
  },
];

export function isFluxaPosBasePackageId(raw: string): raw is FluxaPosBasePackageId {
  return FLUXAPOS_BASE_PACKAGES.some((p) => p.id === raw);
}

export function getFluxaPosBasePackage(id: string | null | undefined) {
  const raw = String(id ?? "").trim().toUpperCase();
  return FLUXAPOS_BASE_PACKAGES.find((p) => p.id === raw) ?? null;
}

export function defaultModulesForFluxaPosPackage(packageId: FluxaPosBasePackageId): Record<string, boolean> {
  switch (packageId) {
    case "FLUXAPOS_START":
      return {
        posCore: true,
        shiftEmail: true,
        kufAnalytics: true,
        pocketWaiter: false,
        kdsKitchen: false,
        redomat: false,
        floorBuilder: false,
        enterTicketing: false,
        ticketMan: false,
        rfidDeposit: false,
        upravaCloud: false,
        pantheonSync: false,
      };
    case "FLUXAPOS_PRO":
      return {
        posCore: true,
        shiftEmail: true,
        kufAnalytics: true,
        pocketWaiter: true,
        kdsKitchen: true,
        redomat: true,
        floorBuilder: true,
        enterTicketing: false,
        ticketMan: false,
        rfidDeposit: false,
        upravaCloud: true,
        pantheonSync: false,
      };
    case "FLUXAPOS_ENTERPRISE":
      return {
        posCore: true,
        shiftEmail: true,
        kufAnalytics: true,
        pocketWaiter: true,
        kdsKitchen: true,
        redomat: true,
        floorBuilder: true,
        enterTicketing: true,
        ticketMan: true,
        rfidDeposit: true,
        upravaCloud: true,
        pantheonSync: true,
      };
    default:
      return {
        posCore: true,
        shiftEmail: true,
        kufAnalytics: true,
        pocketWaiter: false,
        kdsKitchen: false,
        redomat: false,
        floorBuilder: false,
        enterTicketing: false,
        ticketMan: false,
        rfidDeposit: false,
        upravaCloud: false,
        pantheonSync: false,
      };
  }
}

export function calculateFluxaPosPrice(
  packageId: FluxaPosBasePackageId,
  activeModules: Record<string, boolean>,
  kasaCount: number = 1
): { basePrice: number; addonsPrice: number; totalMonthly: number; savings: number } {
  const pkg = getFluxaPosBasePackage(packageId) || FLUXAPOS_BASE_PACKAGES[0];
  const defaultMods = defaultModulesForFluxaPosPackage(packageId);

  let addonsPrice = 0;
  let fullRetailPrice = pkg.priceKm;

  for (const m of FLUXAPOS_MODULE_KEYS) {
    if (m.isCore) continue;
    const isChecked = Boolean(activeModules[m.key]);
    const isIncludedInPackage = Boolean(defaultMods[m.key]);

    if (isChecked && !isIncludedInPackage) {
      addonsPrice += m.priceKm;
    }
    if (isChecked) {
      fullRetailPrice += m.priceKm;
    }
  }

  // Extra registers above max included in package (+25 KM / extra kasa)
  const includedKase = pkg.maxKasa;
  const extraKase = Math.max(0, kasaCount - includedKase);
  const extraKasePrice = extraKase * 25;

  const totalMonthly = (pkg.priceKm + addonsPrice + extraKasePrice);
  const savings = Math.max(0, (fullRetailPrice + extraKasePrice) - totalMonthly);

  return {
    basePrice: pkg.priceKm,
    addonsPrice,
    totalMonthly,
    savings,
  };
}
