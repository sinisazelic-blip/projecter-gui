// src/lib/format.ts

/** Suffix za prikaz valute prema jeziku: en → EUR, sr → KM */
export function getCurrencySuffix(locale: string): string {
  return locale === "en" ? " EUR" : " KM";
}

/** Formatira broj za izvještaje (decimalni separator prema locale) */
export function formatReportNum(
  value: number | string | null | undefined,
  locale: string = "sr",
): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const loc = locale === "en" ? "en-GB" : "bs-BA";
  return n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formatira iznos s odgovarajućom valutom prema jeziku (en → EUR, sr → KM) */
export function formatAmount(value: number | string | null | undefined, locale: string = "sr"): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + getCurrencySuffix(locale);
}

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
 * Prikaz datuma kao dd.mm.yyyy.
 * Prima Date ili string (YYYY-MM-DD / ISO). Za Date iz baze ne koristiti String(date).slice(0,10)
 * jer to daje "Tue Feb 09" bez godine i vodi na pogrešnu godinu pri prikazu.
 */
export function formatDateDMY(input: string | Date | null | undefined) {
  if (input == null) return "";
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else {
    const str = String(input).trim();
    const iso = str.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, day] = iso.split("-").map(Number);
      d = new Date(y, m - 1, day);
    } else {
      d = new Date(str);
    }
  }
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Vraća datum kao YYYY-MM-DD (iz Date objekta ili stringa).
 * Za Date iz baze koristiti ovo umjesto String(date).slice(0,10).
 */
export function toIsoDate(val: string | Date | null | undefined): string | null {
  if (val == null) return null;
  const s = typeof val === "string" ? val.trim() : null;
  if (s && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = val instanceof Date ? val : new Date(val as string);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Legacy -> dogovoreno (za prikaz) */
export function localStatus(s: string | null | undefined) {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "legacy") return "dogovoreno";
  return s ?? "";
}
