/** Statusi tenanta koji smiju koristiti proizvod (do datuma isteka). */
export const LIVE_TENANT_STATUSES = ["AKTIVAN", "PILOT"] as const;

export type LiveTenantStatus = (typeof LIVE_TENANT_STATUSES)[number];

export function normalizeTenantStatus(status: unknown): string {
  return String(status ?? "")
    .trim()
    .toUpperCase();
}

/** PILOT je besplatno korištenje do datuma; ista vrata kao AKTIVAN, druga knjiga. */
export function isLiveTenantStatus(status: unknown): boolean {
  const st = normalizeTenantStatus(status);
  return st === "AKTIVAN" || st === "PILOT";
}

/** Nakon suspenzije: cijena 0 vraća u PILOT, inače u komercijalni AKTIVAN. */
export function restoreStatusAfterSuspend(
  monthlyPrice: unknown,
): LiveTenantStatus {
  if (monthlyPrice == null || monthlyPrice === "") return "PILOT";
  const n = Number(monthlyPrice);
  return Number.isFinite(n) && n === 0 ? "PILOT" : "AKTIVAN";
}
