// src/lib/tenant-billing/index.ts

export const BILLING_CONTACT_EMAIL = "info@fluxa.ba";
export const BILLING_COMPANY_NAME = "Fluxa";
export const BILLING_GRACE_MAX_DAYS = 14;

export const LEGAL_NOTE_BS =
  "Faktura je izdata elektronskim putem, punovažna je bez pečata i potpisa u skladu sa Zakonom o elektronskom dokumentu.";

export const LEGAL_NOTE_EN =
  "This invoice was electronically generated and is valid without a seal or signature.";

export const PAYMENT_ACKNOWLEDGEMENT_NOTE =
  "Zahvaljujemo se na uplati. Vaša uplata je evidentirana. Licenca će biti produžena, a zvanični račun ispostavljen po prispijeću i obradi bankovnog izvoda u toku radnog dana.";

export type TenantBillingStatusType =
  | "PAID"
  | "GRACE_PERIOD"
  | "SUSPENDED"
  | "PILOT";

export interface TenantBillingInfo {
  statusType: TenantBillingStatusType;
  badgeLabel: string;
  badgeColor: "ok" | "warn" | "danger" | "info";
  isGraceActive: boolean;
  graceDaysLeft: number;
  graceDeadlineDate: string; // YYYY-MM-DD (14th of the month)
  subscriptionEndsAtFormatted: string;
  isExpired: boolean;
}

/**
 * Računa pro-rata iznos za klijente koji aktiviraju licencu usred mjeseca (Hetzner model).
 * Formula: (Mesečni zakup / Broj dana u mesecu) * Preostali dani do kraja meseca (uključujući dan starta).
 */
export function calculateProRata(
  monthlyPrice: number,
  startDateInput: string | Date,
): {
  daysInMonth: number;
  remainingDays: number;
  dailyRate: number;
  proRataAmount: number;
  startDateStr: string;
  endOfMonthStr: string;
} {
  const d = new Date(startDateInput);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-based
  const startDay = d.getDate();

  // Ukupan broj dana u tom mjesecu
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - startDay + 1);

  const price = Math.max(0, Number(monthlyPrice) || 0);
  const dailyRate = daysInMonth > 0 ? price / daysInMonth : 0;
  const proRataAmount = Math.round(dailyRate * remainingDays * 100) / 100;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const startDateStr = `${year}-${pad2(month + 1)}-${pad2(startDay)}`;
  const endOfMonthStr = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`;

  return {
    daysInMonth,
    remainingDays,
    dailyRate: Math.round(dailyRate * 100) / 100,
    proRataAmount,
    startDateStr,
    endOfMonthStr,
  };
}

/**
 * Određuje tačan status licence i grace perioda za tenanta.
 */
export function getTenantBillingInfo(
  tenant: {
    status?: string | null;
    subscription_ends_at?: string | Date | null;
  },
  referenceDate = new Date(),
): TenantBillingInfo {
  const rawStatus = String(tenant.status ?? "").trim().toUpperCase();
  const now = referenceDate;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based
  const currentDay = now.getDate();

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const graceDeadlineDate = `${currentYear}-${pad2(currentMonth + 1)}-14`;

  let subEndStr = "";
  let subEndDate: Date | null = null;
  if (tenant.subscription_ends_at) {
    if (typeof tenant.subscription_ends_at === "string") {
      subEndStr = tenant.subscription_ends_at.slice(0, 10);
      subEndDate = new Date(subEndStr + "T23:59:59");
    } else if (tenant.subscription_ends_at instanceof Date) {
      subEndStr = tenant.subscription_ends_at.toISOString().slice(0, 10);
      subEndDate = tenant.subscription_ends_at;
    }
  }

  // Provjera da li je PILOT
  if (rawStatus === "PILOT") {
    return {
      statusType: "PILOT",
      badgeLabel: "PILOT / TEST",
      badgeColor: "info",
      isGraceActive: false,
      graceDaysLeft: 0,
      graceDeadlineDate,
      subscriptionEndsAtFormatted: subEndStr || "—",
      isExpired: false,
    };
  }

  // Provjera eksplicitne suspenzije
  if (rawStatus === "SUSPENDOVAN") {
    return {
      statusType: "SUSPENDOVAN",
      badgeLabel: "SUSPENDOVAN",
      badgeColor: "danger",
      isGraceActive: false,
      graceDaysLeft: 0,
      graceDeadlineDate,
      subscriptionEndsAtFormatted: subEndStr || "—",
      isExpired: true,
    };
  }

  const isExpired = subEndDate ? subEndDate.getTime() < now.getTime() : false;

  // Grace period: ako je datum isteka u tekućem mjesecu ili je prošao, ali je danas <= 14. u mjesecu
  if (currentDay <= BILLING_GRACE_MAX_DAYS) {
    const daysLeft = BILLING_GRACE_MAX_DAYS - currentDay;
    if (isExpired || subEndStr <= graceDeadlineDate) {
      return {
        statusType: "GRACE_PERIOD",
        badgeLabel: `GRACE PERIOD (još ${daysLeft}d)`,
        badgeColor: "warn",
        isGraceActive: true,
        graceDaysLeft: daysLeft,
        graceDeadlineDate,
        subscriptionEndsAtFormatted: subEndStr || "—",
        isExpired: false, // U grace periodu sistem radi normalno
      };
    }
  }

  // Ako je prošao 14. u mjesecu, a licenca je istekla -> Soft suspenzija
  if (isExpired) {
    return {
      statusType: "SUSPENDOVAN",
      badgeLabel: "ISTEKLO / SUSPENDOVANO",
      badgeColor: "danger",
      isGraceActive: false,
      graceDaysLeft: 0,
      graceDeadlineDate,
      subscriptionEndsAtFormatted: subEndStr || "—",
      isExpired: true,
    };
  }

  // Uredno plaćeno
  return {
    statusType: "PAID",
    badgeLabel: "AKTIVAN",
    badgeColor: "ok",
    isGraceActive: false,
    graceDaysLeft: 0,
    graceDeadlineDate,
    subscriptionEndsAtFormatted: subEndStr || "—",
    isExpired: false,
  };
}

/**
 * Formatira puni tekst opisa stavke za fakturu zakupa licence.
 */
export function buildLicenceItemDescription(
  appName: string,
  periodYear: number,
  periodMonth: number,
  contractNo?: string | null,
): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(periodYear, periodMonth, 0).getDate();
  const periodStr = `01.${pad2(periodMonth)}.${periodYear}. – ${pad2(lastDay)}.${pad2(periodMonth)}.${periodYear}.`;

  const contractSuffix = contractNo ? ` po Ugovoru br. ${contractNo}` : "";
  return `Mjesečna pretplata za korišćenje softverskog paketa ${appName} za period ${periodStr}${contractSuffix}`;
}
