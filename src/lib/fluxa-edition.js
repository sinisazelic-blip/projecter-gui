/**
 * Matrica vidljivosti po verziji Fluxe (iz docs/arhiva/Fluxa Compact vs Light vs Core.xlsx).
 * Ključ = ID iz Excela, vrijednost = { full, compact, light, core }.
 */
export const FLUXA_EDITION_VISIBILITY = {
  1: { full: true, compact: true, light: true, core: true },
  2: { full: true, compact: true, light: true, core: true },
  3: { full: true, compact: false, light: false, core: false },
  4: { full: true, compact: false, light: false, core: false },
  5: { full: true, compact: true, light: false, core: false },
  6: { full: true, compact: false, light: false, core: false },
  7: { full: true, compact: true, light: true, core: true },
  8: { full: true, compact: true, light: true, core: true },
  9: { full: true, compact: true, light: true, core: true },
  10: { full: true, compact: true, light: true, core: true },
  11: { full: true, compact: true, light: true, core: true },
  12: { full: true, compact: true, light: true, core: true },
  13: { full: true, compact: true, light: false, core: false },
  14: { full: true, compact: true, light: false, core: false },
  15: { full: true, compact: true, light: false, core: false },
  16: { full: true, compact: true, light: true, core: true },
  17: { full: true, compact: true, light: true, core: true },
  18: { full: true, compact: true, light: true, core: true },
  19: { full: true, compact: true, light: true, core: true },
  20: { full: true, compact: true, light: false, core: false },
  21: { full: true, compact: true, light: false, core: false },
  22: { full: true, compact: true, light: false, core: false },
  23: { full: true, compact: true, light: false, core: false },
  24: { full: true, compact: true, light: true, core: true },
  25: { full: true, compact: true, light: true, core: true },
  26: { full: true, compact: true, light: true, core: true },
  27: { full: true, compact: true, light: true, core: true },
  28: { full: true, compact: true, light: true, core: true },
  29: { full: true, compact: true, light: true, core: true },
  30: { full: true, compact: true, light: true, core: true },
  31: { full: true, compact: true, light: true, core: true },
  32: { full: true, compact: true, light: true, core: true },
  33: { full: true, compact: true, light: true, core: true },
  34: { full: true, compact: true, light: false, core: false },
  35: { full: true, compact: true, light: false, core: false },
  36: { full: true, compact: true, light: true, core: true },
  37: { full: true, compact: true, light: true, core: true },
  38: { full: true, compact: true, light: false, core: false },
  39: { full: true, compact: true, light: false, core: false },
  40: { full: true, compact: true, light: true, core: true },
  41: { full: true, compact: true, light: true, core: true },
  42: { full: true, compact: true, light: true, core: true },
  43: { full: true, compact: true, light: true, core: true },
  44: { full: true, compact: true, light: true, core: true },
  45: { full: true, compact: true, light: true, core: true },
  46: { full: true, compact: true, light: true, core: true },
  47: { full: true, compact: true, light: true, core: true },
  48: { full: true, compact: true, light: true, core: true },
  49: { full: true, compact: true, light: true, core: true },
  50: { full: true, compact: true, light: false, core: false },
  51: { full: true, compact: true, light: false, core: false },
  52: { full: true, compact: true, light: false, core: false },
  53: { full: true, compact: true, light: false, core: false },
  54: { full: true, compact: true, light: true, core: true },
  55: { full: true, compact: true, light: false, core: false },
  56: { full: true, compact: true, light: false, core: false },
  57: { full: true, compact: true, light: false, core: true },
  58: { full: true, compact: true, light: true, core: true },
  59: { full: true, compact: true, light: false, core: false },
  60: { full: true, compact: true, light: true, core: true },
  61: { full: true, compact: true, light: true, core: true },
  62: { full: true, compact: true, light: true, core: true },
  63: { full: true, compact: true, light: true, core: true },
  64: { full: true, compact: true, light: true, core: true },
  65: { full: true, compact: true, light: false, core: false },
  66: { full: true, compact: true, light: true, core: true },
  67: { full: true, compact: true, light: false, core: false },
  68: { full: true, compact: true, light: false, core: false },
  69: { full: true, compact: true, light: true, core: true },
  70: { full: true, compact: true, light: true, core: true },
  71: { full: true, compact: true, light: true, core: true },
  72: { full: true, compact: true, light: false, core: false },
  73: { full: true, compact: true, light: false, core: false },
  74: { full: true, compact: true, light: false, core: false },
  /** Finance Tools (operativni alati za bankovne postinge): samo Full i Compact */
  75: { full: true, compact: true, light: false, core: false },
};

export const FLUXA_EDITIONS = ["Full", "Compact", "Light", "Core"];

const EDITION_KEYS = { Full: "full", Compact: "compact", Light: "light", Core: "core" };

/**
 * @param {number} featureId - ID iz Excela (1-74)
 * @param {string} edition - "Full" | "Compact" | "Light" | "Core"
 * @returns {boolean}
 */
export function isVisibleInEdition(featureId, edition) {
  const row = FLUXA_EDITION_VISIBILITY[featureId];
  if (!row) return true;
  const key = EDITION_KEYS[edition];
  return key ? !!row[key] : true;
}
