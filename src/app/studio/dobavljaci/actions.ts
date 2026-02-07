"use server";

import { query } from "@/lib/db";

type VrstaDobavljaca = "studio" | "freelancer" | "servis" | "ostalo";

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function cleanBool01(v: any) {
  return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
}

function normalizeVrsta(v: any): VrstaDobavljaca {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "studio" || s === "freelancer" || s === "servis") return s;
  return "ostalo";
}

export async function createDobavljac(input: {
  naziv: string;
  vrsta: VrstaDobavljaca;
  pravno_lice?: boolean;
  drzava_iso2?: string | null;
  grad?: string | null;
  postanski_broj?: string | null;
  email?: string | null;
  telefon?: string | null;
  adresa?: string | null;
  napomena?: string | null;
  aktivan?: boolean;
}) {
  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv dobavljača je obavezan.");

  const vrsta = normalizeVrsta(input?.vrsta);
  const pravno_lice = input?.pravno_lice === false ? 0 : 1;

  const drzava_iso2 = cleanStr(input?.drzava_iso2);
  const grad = cleanStr(input?.grad);
  const postanski_broj = cleanStr(input?.postanski_broj);
  const email = cleanStr(input?.email);
  const telefon = cleanStr(input?.telefon);
  const adresa = cleanStr(input?.adresa);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;

  await query(
    `INSERT INTO dobavljaci
      (naziv, vrsta, pravno_lice, drzava_iso2, grad, postanski_broj, email, telefon, adresa, napomena, aktivan)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      naziv,
      vrsta,
      pravno_lice,
      drzava_iso2,
      grad,
      postanski_broj,
      email,
      telefon,
      adresa,
      napomena,
      aktivan,
    ]
  );

  return { ok: true };
}

export async function updateDobavljac(input: {
  dobavljac_id: number;
  naziv: string;
  vrsta: VrstaDobavljaca;
  pravno_lice?: boolean;
  drzava_iso2?: string | null;
  grad?: string | null;
  postanski_broj?: string | null;
  email?: string | null;
  telefon?: string | null;
  adresa?: string | null;
  napomena?: string | null;
  aktivan?: boolean;
}) {
  const id = Number(input?.dobavljac_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Neispravan dobavljac_id.");

  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv dobavljača je obavezan.");

  const vrsta = normalizeVrsta(input?.vrsta);
  const pravno_lice = input?.pravno_lice === false ? 0 : 1;

  const drzava_iso2 = cleanStr(input?.drzava_iso2);
  const grad = cleanStr(input?.grad);
  const postanski_broj = cleanStr(input?.postanski_broj);
  const email = cleanStr(input?.email);
  const telefon = cleanStr(input?.telefon);
  const adresa = cleanStr(input?.adresa);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;

  await query(
    `UPDATE dobavljaci
        SET naziv=?, vrsta=?, pravno_lice=?, drzava_iso2=?, grad=?, postanski_broj=?,
            email=?, telefon=?, adresa=?, napomena=?, aktivan=?
      WHERE dobavljac_id=?`,
    [
      naziv,
      vrsta,
      pravno_lice,
      drzava_iso2,
      grad,
      postanski_broj,
      email,
      telefon,
      adresa,
      napomena,
      aktivan,
      id,
    ]
  );

  return { ok: true };
}

export async function setDobavljacActive(input: { dobavljac_id: number; aktivan: boolean }) {
  const id = Number(input?.dobavljac_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Neispravan dobavljac_id.");

  await query(`UPDATE dobavljaci SET aktivan=? WHERE dobavljac_id=?`, [
    input?.aktivan ? 1 : 0,
    id,
  ]);

  return { ok: true };
}

