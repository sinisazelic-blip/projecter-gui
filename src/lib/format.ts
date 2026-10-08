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

/**
 * IOS / dokumenti: ako je faktura ili stavka u EUR (ili drugoj valuti), prikaži tu valutu;
 * za BAM/KM ili prazno koristi postojeće pravilo locale (sr → KM, en → EUR).
 */
export function formatAmountForDocumentValuta(
  value: number | string | null | undefined,
  locale: string = "sr",
  documentValuta?: string | null,
): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const v = String(documentValuta ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  let suffix: string;
  if (v === "EUR") suffix = " EUR";
  else if (v === "USD") suffix = " USD";
  else if (v === "GBP") suffix = " GBP";
  else if (v === "CHF") suffix = " CHF";
  else if (v === "BAM" || v === "KM" || v === "") suffix = getCurrencySuffix(locale);
  else suffix = ` ${v}`;
  return n.toFixed(2) + suffix;
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

/**
 * Pametni Numpad i string parser za novčane iznose:
 * Podržava unos sa numeričke tastature (zarez kao decimala),
 * domaći format (1.234,56), US format (1,234.56), i čiste brojeve.
 */
export function parseMoneyInput(input: string | number | null | undefined): number {
  if (input == null || input === "") return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;

  let s = String(input).trim();
  // Ukloni valute, razmake, slova
  s = s.replace(/[^\d.,\-+]/g, "");
  if (!s) return 0;

  // Ako sadrži i tačku i zarez (npr. 1.234,56 ili 1,234.56)
  if (s.includes(".") && s.includes(",")) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // 1.234,56 (BA standard) -> ukloni tačke hiljada, zarez pretvori u tačku
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 (US standard) -> ukloni zareze hiljada
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Sadrži samo zarez (npr. "1250,50" sa numeričke tastature) -> pretvori u tačku
    s = s.replace(",", ".");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Standardni format prikaza novca prema domaćem BA/sr standardu:
 * 1.234,56 KM (hiljadski separator tačka, decimalni zarez).
 */
export function fmtMoneyBA(amount: number | string | null | undefined, currency = "KM"): string {
  const n = typeof amount === "string" ? parseMoneyInput(amount) : Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat("bs-BA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return currency ? `${formatted} ${currency}` : formatted;
}

