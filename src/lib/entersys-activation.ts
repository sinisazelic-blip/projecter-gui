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

export interface EnterSysLicenceConfig {
  tenantId: string;
  tenantName: string;
  context: EnterSysContext;
  tier: EnterSysTier;
  billingMode: EnterSysBillingMode;
  presaleDailyRateEur?: number;
  eventDailyRateEur?: number;
  modules: {
    enterCore: boolean;
    poolManager: boolean;
    eventManager: boolean;
    rentals: boolean;
    lockers: boolean;
    mojRadio: boolean;
    mojTv: boolean;
    b2bPortal: boolean;
  };
}

/**
 * Kalkulacija fiksne cene za utakmice, koncerte i događaje (FK Borac model):
 * Pretprodaja po danu + Glavni dan događaja (Full CampNow). Bez procenata od karata!
 */
export function calculateEventLicenceFee(input: {
  presaleDays: number;
  eventDays: number;
  capacityTier: "SMALL" | "MEDIUM" | "LARGE";
}) {
  // Cene po kapacitetu stadiona/arene
  const rates = {
    SMALL: { presalePerDay: 5, eventPerDay: 50 },     // < 1.000 gledalaca
    MEDIUM: { presalePerDay: 10, eventPerDay: 150 },   // 1.000 - 8.000 gledalaca
    LARGE: { presalePerDay: 20, eventPerDay: 350 },    // > 8.000 gledalaca (Stadion/Veliki koncert)
  }[input.capacityTier];

  const presaleTotal = input.presaleDays * rates.presalePerDay;
  const eventTotal = input.eventDays * rates.eventPerDay;
  const grandTotal = presaleTotal + eventTotal;

  return {
    presaleDays: input.presaleDays,
    presaleDailyRateEur: rates.presalePerDay,
    presaleTotalEur: presaleTotal,
    eventDays: input.eventDays,
    eventDailyRateEur: rates.eventPerDay,
    eventTotalEur: eventTotal,
    grandTotalEur: grandTotal,
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
    mojRadio: tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    mojTv: tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    b2bPortal: tier === "ENTERPRISE",
  };
}
