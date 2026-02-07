// src/lib/format.ts

export function formatKM(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;

  return new Intl.NumberFormat("bs-BA", {
    style: "currency",
    currency: "BAM",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Prikaz datuma kao dd.mm.yyyy
 * Radi za ISO string ("2026-01-24", "2026-01-24T...") i Date.
 */
export function formatDateDMY(input: string | Date | null | undefined) {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Legacy -> dogovoreno (za prikaz) */
export function localStatus(s: string | null | undefined) {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "legacy") return "dogovoreno";
  return s ?? "";
}
