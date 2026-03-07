"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

const FREQUENCIES = ["MJESECNO", "GODISNJE", "JEDNOKRATNO"];
const VALUTE = ["BAM", "EUR"];

function assertNaziv(naziv) {
  const s = String(naziv ?? "").trim();
  if (!s) throw new Error("Naziv je obavezan.");
  if (s.length > 255) throw new Error("Naziv je predugačak (max 255).");
}

function assertFrekvencija(frekvencija) {
  if (!FREQUENCIES.includes(frekvencija))
    throw new Error("Neispravna frekvencija.");
}

function parseIznos(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Iznos mora biti broj.");
  if (n < 0) throw new Error("Iznos ne može biti negativan.");
  return Math.round(n * 100) / 100;
}

function parseDan(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 31)
    throw new Error("Dan u mjesecu mora biti 1–31.");
  return n;
}

function parseDate(v) {
  const s = String(v ?? "").trim().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normValuta(v) {
  const u = String(v ?? "BAM").trim().toUpperCase();
  if (u === "KM") return "BAM";
  return VALUTE.includes(u) ? u : "BAM";
}

export async function createFiksniTrosak(data) {
  assertNaziv(data.naziv_troska);
  assertFrekvencija(data.frekvencija);
  const iznos = parseIznos(data.iznos);
  const valuta = normValuta(data.valuta);
  const dan_u_mjesecu = parseDan(data.dan_u_mjesecu);
  const datum_dospijeca = parseDate(data.datum_dospijeca);
  const aktivan = data.aktivan ? 1 : 0;

  await query(
    `INSERT INTO fiksni_troskovi
     (naziv_troska, frekvencija, dan_u_mjesecu, datum_dospijeca, zadnje_placeno, iznos, valuta, aktivan)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
    [
      data.naziv_troska.trim(),
      data.frekvencija,
      dan_u_mjesecu,
      datum_dospijeca,
      iznos,
      valuta,
      aktivan,
    ],
  );

  revalidatePath("/finance/fiksni-troskovi");
  revalidatePath("/finance/fiksni-troskovi/raspored");
  revalidatePath("/finance/cashflow");
  revalidatePath("/finance/kuf");
  return { ok: true };
}

export async function updateFiksniTrosak(data) {
  const id = Number(data.trosak_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan ID troška.");

  assertNaziv(data.naziv_troska);
  assertFrekvencija(data.frekvencija);
  const iznos = parseIznos(data.iznos);
  const valuta = normValuta(data.valuta);
  const dan_u_mjesecu = parseDan(data.dan_u_mjesecu);
  const datum_dospijeca = parseDate(data.datum_dospijeca);
  const aktivan = data.aktivan ? 1 : 0;

  await query(
    `UPDATE fiksni_troskovi
     SET naziv_troska = ?,
         frekvencija = ?,
         dan_u_mjesecu = ?,
         datum_dospijeca = ?,
         iznos = ?,
         valuta = ?,
         aktivan = ?
     WHERE trosak_id = ?`,
    [
      data.naziv_troska.trim(),
      data.frekvencija,
      dan_u_mjesecu,
      datum_dospijeca,
      iznos,
      valuta,
      aktivan,
      id,
    ],
  );

  revalidatePath("/finance/fiksni-troskovi");
  revalidatePath("/finance/fiksni-troskovi/raspored");
  revalidatePath("/finance/cashflow");
  revalidatePath("/finance/kuf");
  return { ok: true };
}

/** Postavi aktivan = 0 (soft delete) ili 1 (reaktiviraj). */
export async function setFiksniTrosakActive(trosak_id, aktivan) {
  const id = Number(trosak_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan ID troška.");
  const active = aktivan ? 1 : 0;

  await query(
    `UPDATE fiksni_troskovi SET aktivan = ? WHERE trosak_id = ?`,
    [active, id],
  );

  revalidatePath("/finance/fiksni-troskovi");
  revalidatePath("/finance/fiksni-troskovi/raspored");
  revalidatePath("/finance/cashflow");
  revalidatePath("/finance/kuf");
  return { ok: true };
}
