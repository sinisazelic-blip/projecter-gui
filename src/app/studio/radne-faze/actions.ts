"use server";

import { query } from "@/lib/db";

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function createRadnaFaza(input: {
  naziv: string;
  opis_poslova?: string | null;
  slozenost_posla?: string | null;
  vrsta_posla?: string | null;
}) {
  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv je obavezan.");

  const opis_poslova = cleanStr(input?.opis_poslova);
  const slozenost_posla = cleanStr(input?.slozenost_posla);
  const vrsta_posla = cleanStr(input?.vrsta_posla);

  await query(
    `INSERT INTO radne_faze (naziv, opis_poslova, slozenost_posla, vrsta_posla)
     VALUES (?,?,?,?)`,
    [naziv, opis_poslova, slozenost_posla, vrsta_posla],
  );

  return { ok: true };
}

export async function updateRadnaFaza(input: {
  faza_id: number;
  naziv: string;
  opis_poslova?: string | null;
  slozenost_posla?: string | null;
  vrsta_posla?: string | null;
}) {
  const id = Number(input?.faza_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan faza_id.");

  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv je obavezan.");

  const opis_poslova = cleanStr(input?.opis_poslova);
  const slozenost_posla = cleanStr(input?.slozenost_posla);
  const vrsta_posla = cleanStr(input?.vrsta_posla);

  await query(
    `UPDATE radne_faze
        SET naziv=?, opis_poslova=?, slozenost_posla=?, vrsta_posla=?
      WHERE faza_id=?`,
    [naziv, opis_poslova, slozenost_posla, vrsta_posla, id],
  );

  return { ok: true };
}
