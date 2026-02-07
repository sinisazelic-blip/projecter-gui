"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

type Jedinica = "KOM" | "SAT" | "MIN" | "PAKET" | "DAN" | "OSTALO";

function normCurrencyToDb(valutaUi: string): string {
  const v = String(valutaUi || "").trim().toUpperCase();
  if (!v) return "BAM";
  // UI uses "KM" for domestic currency; DB is BAM.
  if (v === "KM") return "BAM";
  return v.slice(0, 3);
}

function assertValidName(naziv: string) {
  const s = String(naziv || "").trim();
  if (!s) throw new Error("Naziv je obavezan.");
  if (s.length > 255) throw new Error("Naziv je predugačak (max 255).");
}

function parsePrice(input: any): number {
  const n = Number(String(input ?? "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Cijena mora biti broj.");
  if (n < 0) throw new Error("Cijena ne može biti negativna.");
  // DB is decimal(12,2)
  return Math.round(n * 100) / 100;
}

// NEW: optional EUR price ("" => NULL)
function parsePriceNullable(input: any): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("INO cijena (EUR) mora biti broj.");
  if (n < 0) throw new Error("INO cijena (EUR) ne može biti negativna.");
  return Math.round(n * 100) / 100;
}

function assertUnit(jedinica: string): asserts jedinica is Jedinica {
  const allowed = ["KOM", "SAT", "MIN", "PAKET", "DAN", "OSTALO"];
  if (!allowed.includes(jedinica)) throw new Error("Neispravna jedinica.");
}

export async function createCjenovnikItem(data: {
  naziv: string;
  jedinica: string;
  cijena_default: any;
  cijena_ino_eur?: any; // NEW
  valuta_ui: string; // "KM" or "EUR" etc
  active: boolean;
}) {
  assertValidName(data.naziv);
  assertUnit(data.jedinica);

  const cijena = parsePrice(data.cijena_default);
  const cijenaIno = parsePriceNullable(data.cijena_ino_eur); // NEW
  const valutaDb = normCurrencyToDb(data.valuta_ui);
  const active = data.active ? 1 : 0;

  await query(
    `INSERT INTO cjenovnik_stavke
      (naziv, jedinica, cijena_default, cijena_ino_eur, valuta_default, sort_order, active)
     VALUES (?, ?, ?, ?, ?, 1000, ?)`,
    [data.naziv.trim(), data.jedinica, cijena, cijenaIno, valutaDb, active]
  );

  revalidatePath("/studio/cjenovnik");
  return { ok: true };
}

export async function updateCjenovnikItem(data: {
  stavka_id: number;
  naziv: string;
  jedinica: string;
  cijena_default: any;
  cijena_ino_eur?: any; // NEW
  valuta_ui: string;
  active: boolean;
}) {
  const id = Number(data.stavka_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Neispravan ID stavke.");

  assertValidName(data.naziv);
  assertUnit(data.jedinica);

  const cijena = parsePrice(data.cijena_default);
  const cijenaIno = parsePriceNullable(data.cijena_ino_eur); // NEW
  const valutaDb = normCurrencyToDb(data.valuta_ui);
  const active = data.active ? 1 : 0;

  await query(
    `UPDATE cjenovnik_stavke
     SET naziv = ?,
         jedinica = ?,
         cijena_default = ?,
         cijena_ino_eur = ?,
         valuta_default = ?,
         active = ?
     WHERE stavka_id = ?`,
    [data.naziv.trim(), data.jedinica, cijena, cijenaIno, valutaDb, active, id]
  );

  revalidatePath("/studio/cjenovnik");
  return { ok: true };
}

export async function setCjenovnikActive(data: { stavka_id: number; active: boolean }) {
  const id = Number(data.stavka_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Neispravan ID stavke.");

  const active = data.active ? 1 : 0;

  await query(`UPDATE cjenovnik_stavke SET active = ? WHERE stavka_id = ?`, [active, id]);

  revalidatePath("/studio/cjenovnik");
  return { ok: true };
}
