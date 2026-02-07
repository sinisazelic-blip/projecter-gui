"use server";

import { query } from "@/lib/db";

type VrstaTalenta = "spiker" | "glumac" | "pjevac" | "dijete" | "muzicar" | "ostalo";

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function normalizeVrsta(v: any): VrstaTalenta {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "spiker" || s === "glumac" || s === "pjevac" || s === "dijete" || s === "muzicar") return s;
  return "ostalo";
}

export async function createTalent(input: {
  ime_prezime: string;
  vrsta: VrstaTalenta;
  email?: string | null;
  telefon?: string | null;
  napomena?: string | null;
  aktivan?: boolean;
}) {
  const ime = String(input?.ime_prezime ?? "").trim();
  if (!ime) throw new Error("Ime i prezime je obavezno.");

  const vrsta = normalizeVrsta(input?.vrsta);
  const email = cleanStr(input?.email);
  const telefon = cleanStr(input?.telefon);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;

  await query(
    `INSERT INTO talenti (ime_prezime, vrsta, email, telefon, napomena, aktivan)
     VALUES (?,?,?,?,?,?)`,
    [ime, vrsta, email, telefon, napomena, aktivan]
  );

  return { ok: true };
}

export async function updateTalent(input: {
  talent_id: number;
  ime_prezime: string;
  vrsta: VrstaTalenta;
  email?: string | null;
  telefon?: string | null;
  napomena?: string | null;
  aktivan?: boolean;
}) {
  const id = Number(input?.talent_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Neispravan talent_id.");

  const ime = String(input?.ime_prezime ?? "").trim();
  if (!ime) throw new Error("Ime i prezime je obavezno.");

  const vrsta = normalizeVrsta(input?.vrsta);
  const email = cleanStr(input?.email);
  const telefon = cleanStr(input?.telefon);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;

  await query(
    `UPDATE talenti
        SET ime_prezime=?, vrsta=?, email=?, telefon=?, napomena=?, aktivan=?
      WHERE talent_id=?`,
    [ime, vrsta, email, telefon, napomena, aktivan, id]
  );

  return { ok: true };
}

export async function setTalentActive(input: { talent_id: number; aktivan: boolean }) {
  const id = Number(input?.talent_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Neispravan talent_id.");

  await query(`UPDATE talenti SET aktivan=? WHERE talent_id=?`, [input?.aktivan ? 1 : 0, id]);
  return { ok: true };
}
