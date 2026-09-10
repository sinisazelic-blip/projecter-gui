/**
 * FluxaPOS Platform - Studio Integration Module & Licensing Engine
 * Upravljanje licencama, paketima, brojem kasa i kalkulaciji troškova za FluxaPOS tenante.
 */

export const FLUXAPOS_BASE_PACKAGES = [
  {
    id: "FLUXAPOS_START",
    label: "FluxaPOS Start (1 Kasa / Šank)",
    priceKm: 60,
    priceEur: 30,
    maxKasa: 1,
    description: "Samostalna ugostiteljska ili trgovačka kasa sa fiskalizacijom i izveštajima smjene",
  },
  {
    id: "FLUXAPOS_PRO",
    label: "FluxaPOS Pro (Kasa + KDS + Mobilni Konobar)",
    priceKm: 120,
    priceEur: 60,
    maxKasa: 3,
    description: "Kompletan ugostiteljski paket sa kuhinjskim displejem (KDS) i Džepnim konobarom",
  },
  {
    id: "FLUXAPOS_ENTERPRISE",
    label: "FluxaPOS Enterprise (Multi-kasa + ERP + Biletarnica)",
    priceKm: 220,
    priceEur: 110,
    maxKasa: 10,
    description: "Kompletna sinhronizacija sa Pantheon ERP-om, EnterSYS biletarnicom i neograničenim kasama",
  },
] as const;

export type FluxaPosBasePackageId = (typeof FLUXAPOS_BASE_PACKAGES)[number]["id"];

export const FLUXAPOS_MODULE_KEYS = [
  { key: "posCore", label: "FluxaPOS Glavna Kasa" },
  { key: "kdsKitchen", label: "Kuhinjski Displej (KDS)" },
  { key: "pocketWaiter", label: "Džepni Konobar (Mobilni)" },
  { key: "pantheonSync", label: "Pantheon ERP Sinhronizacija" },
  { key: "enterTicketing", label: "EnterSYS Biletarnica" },
  { key: "shiftEmail", label: "Email / PDF / Viber Izvještaji" },
  { key: "rfidDeposit", label: "RFID Porodični Depoziti" },
] as const;

export function isFluxaPosBasePackageId(raw: string): raw is FluxaPosBasePackageId {
  return FLUXAPOS_BASE_PACKAGES.some((p) => p.id === raw);
}

export function getFluxaPosBasePackage(id: string | null | undefined) {
  const raw = String(id ?? "").trim().toUpperCase();
  return FLUXAPOS_BASE_PACKAGES.find((p) => p.id === raw) ?? null;
}

export function defaultModulesForFluxaPosPackage(packageId: FluxaPosBasePackageId) {
  switch (packageId) {
    case "FLUXAPOS_START":
      return {
        posCore: true,
        kdsKitchen: false,
        pocketWaiter: false,
        pantheonSync: false,
        enterTicketing: false,
        shiftEmail: true,
        rfidDeposit: false,
      };
    case "FLUXAPOS_PRO":
      return {
        posCore: true,
        kdsKitchen: true,
        pocketWaiter: true,
        pantheonSync: false,
        enterTicketing: false,
        shiftEmail: true,
        rfidDeposit: true,
      };
    case "FLUXAPOS_ENTERPRISE":
      return {
        posCore: true,
        kdsKitchen: true,
        pocketWaiter: true,
        pantheonSync: true,
        enterTicketing: true,
        shiftEmail: true,
        rfidDeposit: true,
      };
    default:
      return {
        posCore: true,
        kdsKitchen: true,
        pocketWaiter: true,
        pantheonSync: true,
        enterTicketing: true,
        shiftEmail: true,
        rfidDeposit: true,
      };
  }
}
