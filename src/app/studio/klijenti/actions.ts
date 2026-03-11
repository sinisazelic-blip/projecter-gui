"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

type TipKlijenta = "direktni" | "agencija";

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function cleanInt(v: any) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function normalizeTip(v: any): TipKlijenta {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "agencija" ? "agencija" : "direktni";
}

function toBit(v: any): 0 | 1 {
  return v ? 1 : 0;
}

export async function createKlijent(input: {
  naziv_klijenta: string;
  tip_klijenta: TipKlijenta;
  porezni_id?: string | null;
  jib?: string | null;
  pib?: string | null;
  adresa?: string | null;
  grad?: string | null;
  drzava?: string | null;
  email?: string | null;
  rok_placanja_dana?: number | string;
  napomena?: string | null;
  aktivan?: boolean;
  is_ino?: boolean;
  pdv_oslobodjen?: boolean;
  pdv_oslobodjen_napomena?: string | null;
}) {
  const naziv = String(input?.naziv_klijenta ?? "").trim();
  if (!naziv) throw new Error("Naziv klijenta je obavezan.");

  const tip = normalizeTip(input?.tip_klijenta);
  const porezni_id = cleanStr(input?.porezni_id);
  const jib = cleanStr(input?.jib);
  const pib = cleanStr(input?.pib);
  const adresa = cleanStr(input?.adresa);
  const grad = cleanStr(input?.grad);
  const drzava = cleanStr(input?.drzava);
  const email = cleanStr(input?.email);
  const rok = cleanInt(input?.rok_placanja_dana);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;
  const is_ino = toBit(input?.is_ino);
  const pdv_oslobodjen = toBit(input?.pdv_oslobodjen);
  const pdv_oslobodjen_napomena = cleanStr(input?.pdv_oslobodjen_napomena);

  const hasJibPib = input.jib !== undefined || input.pib !== undefined;
  const jibPibCols = hasJibPib ? ", jib, pib" : "";
  const jibPibPlc = hasJibPib ? ", ?, ?" : "";
  const jibPibVals = hasJibPib ? [jib ?? null, pib ?? null] : [];

  await query(
    `INSERT INTO klijenti
      (naziv_klijenta, tip_klijenta, porezni_id, adresa, grad, drzava, email, rok_placanja_dana, napomena, aktivan, is_ino, pdv_oslobodjen, pdv_oslobodjen_napomena${jibPibCols}, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?${jibPibPlc}, NOW(), NOW())`,
    [
      naziv,
      tip,
      porezni_id,
      adresa,
      grad,
      drzava,
      email,
      rok,
      napomena,
      aktivan,
      is_ino,
      pdv_oslobodjen,
      pdv_oslobodjen_napomena,
      ...jibPibVals,
    ],
  );

  revalidatePath("/studio/klijenti");
  return { ok: true };
}

export async function updateKlijent(input: {
  klijent_id: number;
  naziv_klijenta: string;
  tip_klijenta: TipKlijenta;
  porezni_id?: string | null;
  jib?: string | null;
  pib?: string | null;
  adresa?: string | null;
  grad?: string | null;
  drzava?: string | null;
  email?: string | null;
  rok_placanja_dana?: number | string;
  napomena?: string | null;
  aktivan?: boolean;
  is_ino?: boolean;
  pdv_oslobodjen?: boolean;
  pdv_oslobodjen_napomena?: string | null;
}) {
  const id = Number(input?.klijent_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan klijent_id.");

  const naziv = String(input?.naziv_klijenta ?? "").trim();
  if (!naziv) throw new Error("Naziv klijenta je obavezan.");

  const tip = normalizeTip(input?.tip_klijenta);
  const porezni_id = cleanStr(input?.porezni_id);
  const jib = cleanStr(input?.jib);
  const pib = cleanStr(input?.pib);
  const adresa = cleanStr(input?.adresa);
  const grad = cleanStr(input?.grad);
  const drzava = cleanStr(input?.drzava);
  const email = cleanStr(input?.email);
  const rok = cleanInt(input?.rok_placanja_dana);
  const napomena = cleanStr(input?.napomena);
  const aktivan = input?.aktivan === false ? 0 : 1;
  const is_ino = toBit(input?.is_ino);
  const pdv_oslobodjen = toBit(input?.pdv_oslobodjen);
  const pdv_oslobodjen_napomena = cleanStr(input?.pdv_oslobodjen_napomena);

  const hasJibPib = input.jib !== undefined || input.pib !== undefined;
  const jibPibSet = hasJibPib ? ", jib=?, pib=?" : "";
  const jibPibVals = hasJibPib ? [jib ?? null, pib ?? null] : [];

  await query(
    `UPDATE klijenti
        SET naziv_klijenta=?,
            tip_klijenta=?,
            porezni_id=?,
            adresa=?,
            grad=?,
            drzava=?,
            email=?,
            rok_placanja_dana=?,
            napomena=?,
            aktivan=?,
            is_ino=?,
            pdv_oslobodjen=?,
            pdv_oslobodjen_napomena=?${jibPibSet},
            updated_at=NOW()
      WHERE klijent_id=?`,
    [
      naziv,
      tip,
      porezni_id,
      adresa,
      grad,
      drzava,
      email,
      rok,
      napomena,
      aktivan,
      is_ino,
      pdv_oslobodjen,
      pdv_oslobodjen_napomena,
      ...jibPibVals,
      id,
    ],
  );

  const [row] = (await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM klijenti WHERE klijent_id = ?`,
    [id],
  )) as { created_at: string | null; updated_at: string | null }[];

  revalidatePath("/studio/klijenti");
  return {
    ok: true,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function setKlijentActive(input: {
  klijent_id: number;
  aktivan: boolean;
}) {
  const id = Number(input?.klijent_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan klijent_id.");

  await query(`UPDATE klijenti SET aktivan=?, updated_at=NOW() WHERE klijent_id=?`, [
    input?.aktivan ? 1 : 0,
    id,
  ]);
  revalidatePath("/studio/klijenti");
  return { ok: true };
}
