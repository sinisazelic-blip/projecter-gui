/**
 * Server-side prevodi: getT(locale) vraća funkciju t(key).
 * Za korištenje u server komponentama: await cookies() → locale → getT(locale).
 */
import { getValidLocale } from "@/lib/i18n";
import sr from "@/locales/sr.json";
import en from "@/locales/en.json";

const messages = { sr, en };

function getNested(obj, path) {
  if (!obj || typeof path !== "string") return null;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return null;
  }
  return typeof cur === "string" ? cur : null;
}

/**
 * Vraća funkciju t(key) za dati locale. Za server komponente.
 * @param {string} locale - 'sr' | 'en'
 * @returns {(key: string) => string}
 */
export function getT(locale) {
  const loc = getValidLocale(locale);
  const m = messages[loc] || messages.sr;
  return function t(key) {
    return getNested(m, key) || key;
  };
}
