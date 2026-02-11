// src/app/actions/finance/finance.validate.js

export function t(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function mustInt(label, v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`${label} mora biti pozitivan integer.`);
  return n;
}

export function mustEnum(label, v, allowed) {
  const s = t(v);
  if (!allowed.includes(s))
    throw new Error(`${label} mora biti jedno od: ${allowed.join(", ")}`);
  return s;
}

export function optStr(label, v, max = 255) {
  const s = t(v);
  if (!s) return null;
  if (s.length > max) throw new Error(`${label} je predugačko (max ${max}).`);
  return s;
}

export function mustMoney(label, v) {
  const s = t(v);
  if (!s) throw new Error(`${label} je obavezno.`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label} mora biti broj.`);
  // 2 decimale (KM)
  const r = Math.round(n * 100) / 100;
  if (r <= 0) throw new Error(`${label} mora biti > 0.`);
  return r;
}

export function mustDate(label, v) {
  const s = t(v);
  if (!s || s.length < 10) throw new Error(`${label} nije validan datum.`);
  // očekujemo YYYY-MM-DD
  return s.slice(0, 10);
}

export function optDate(v) {
  const s = t(v);
  if (!s) return null;
  if (s.length < 10) throw new Error(`Datum nije validan.`);
  return s.slice(0, 10);
}

/**
 * amount_km je "alokacija" iz posting-a.
 * U link tabelama uvijek čuvamo pozitivan iznos (dio transakcije),
 * a znak provjeravamo prema posting.amount (incoming/outgoing).
 */
export function mustAllocationKm(v) {
  return mustMoney("amount_km", v);
}
