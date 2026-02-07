// src/app/actions/inventory/inventory.validate.js

export function toTrimmed(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function assertNonEmpty(label, v, maxLen = 255) {
  const s = toTrimmed(v);
  if (!s) throw new Error(`${label} je obavezno.`);
  if (s.length > maxLen) throw new Error(`${label} je predugačko (max ${maxLen}).`);
  return s;
}

export function assertEnum(label, v, allowed) {
  const s = toTrimmed(v);
  if (!allowed.includes(s)) throw new Error(`${label} mora biti jedno od: ${allowed.join(", ")}`);
  return s;
}

export function assertBool(label, v) {
  if (v === true || v === 1 || v === "1" || v === "true") return 1;
  if (v === false || v === 0 || v === "0" || v === "false") return 0;
  throw new Error(`${label} mora biti true/false.`);
}

export function assertOptionalStr(label, v, maxLen = 255) {
  const s = toTrimmed(v);
  if (!s) return null;
  if (s.length > maxLen) throw new Error(`${label} je predugačko (max ${maxLen}).`);
  return s;
}

export function assertQtyPositive(v) {
  const s = toTrimmed(v);
  if (!s) throw new Error("Količina je obavezna.");
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error("Količina mora biti broj.");
  if (n <= 0) throw new Error("Količina mora biti veća od 0.");
  // DECIMAL(12,3) – zadrži do 3 decimale
  const rounded = Math.round(n * 1000) / 1000;
  if (rounded <= 0) throw new Error("Količina mora biti veća od 0.");
  return rounded;
}

export function assertMovementAt(v) {
  // očekujemo string "YYYY-MM-DD HH:mm:ss" ili Date; ako prazno -> sad
  if (!v) return new Date();
  if (v instanceof Date) return v;
  const s = toTrimmed(v);
  // minimalna provjera: "YYYY-MM-DD"
  if (s.length < 10) throw new Error("Datum/vrijeme (movement_at) nije validan.");
  return s; // prosljeđujemo MySQL-u kao string
}
