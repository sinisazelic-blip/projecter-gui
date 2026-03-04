"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

type VrstaTalenta =
  | "spiker"
  | "glumac"
  | "pjevac"
  | "dijete"
  | "muzicar"
  | "ostalo"
  | "snimatelj"
  | "kompozitor"
  | "copywriter"
  | "producent"
  | "montazer"
  | "reziser"
  | "organizator"
  | "account"
  | "developer";

const VRSTA_VALUES: Set<string> = new Set([
  "spiker", "glumac", "pjevac", "dijete", "muzicar", "ostalo",
  "snimatelj", "kompozitor", "copywriter", "producent", "montazer",
  "reziser", "organizator", "account", "developer",
]);

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function normalizeVrsta(v: any): VrstaTalenta {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (VRSTA_VALUES.has(s)) return s as VrstaTalenta;
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
    `INSERT INTO talenti (ime_prezime, vrsta, email, telefon, napomena, aktivan, created_at, updated_at)
     VALUES (?,?,?,?,?,?, NOW(), NOW())`,
    [ime, vrsta, email, telefon, napomena, aktivan],
  );

  revalidatePath("/studio/talenti");
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
        SET ime_prezime=?, vrsta=?, email=?, telefon=?, napomena=?, aktivan=?,
            updated_at=NOW()
      WHERE talent_id=?`,
    [ime, vrsta, email, telefon, napomena, aktivan, id],
  );

  const [row] = (await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM talenti WHERE talent_id = ?`,
    [id],
  )) as { created_at: string | null; updated_at: string | null }[];

  revalidatePath("/studio/talenti");
  return {
    ok: true,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function setTalentActive(input: {
  talent_id: number;
  aktivan: boolean;
}) {
  const id = Number(input?.talent_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Neispravan talent_id.");

  await query(`UPDATE talenti SET aktivan=?, updated_at=NOW() WHERE talent_id=?`, [
    input?.aktivan ? 1 : 0,
    id,
  ]);
  revalidatePath("/studio/talenti");
  return { ok: true };
}
