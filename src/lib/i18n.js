/**
 * i18n: čitanje/pisanje jezika u cookie. Klijent koristi document.cookie, server (ako zatreba) čita iz request cookie.
 */
const COOKIE_NAME = "NEXT_LOCALE";
const DEFAULT_LOCALE = "sr";
const VALID_LOCALES = ["sr", "en"];

export function getValidLocale(locale) {
  return VALID_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function getLocaleFromCookie(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== "string") return DEFAULT_LOCALE;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return getValidLocale(match ? match[1].trim() : DEFAULT_LOCALE);
}

/** Za klijent: čita iz document.cookie */
export function getLocaleFromDocument() {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return getValidLocale(match ? match[1].trim() : DEFAULT_LOCALE);
}

/** Za klijent: postavlja cookie (trajanje 1 godina) */
export function setLocaleInDocument(locale) {
  const value = getValidLocale(locale);
  if (typeof document === "undefined") return value;
  document.cookie = `${COOKIE_NAME}=${value};path=/;max-age=31536000;SameSite=Lax`;
  return value;
}

/**
 * Valuta po regionu (Regional Settings).
 * sr (BiH) → KM, en (EU) → EUR. Kasnije npr. "us" → USD.
 */
export function getCurrencyForLocale(locale) {
  const loc = getValidLocale(locale);
  if (loc === "en") return "EUR";
  return "KM";
}

export { DEFAULT_LOCALE, VALID_LOCALES, COOKIE_NAME };
