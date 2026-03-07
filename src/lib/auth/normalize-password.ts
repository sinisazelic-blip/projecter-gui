/**
 * Normalizuje lozinku pri usporedbi i hashiranju: uklanja BOM, NBSP,
 * zamjenjuje full-width plus i druge „pametne” znakove s ASCII verzijama.
 * Koristi pri login-u i pri kreiranju/izmjeni korisnika da se + i sl. konzistentno tretiraju.
 */
export function normalizePassword(s: string): string {
  return s
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u2024/g, ".")
    .replace(/\u00B7/g, ".")
    .replace(/\uFF0B/g, "+")
    .trim();
}
