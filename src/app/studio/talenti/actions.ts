"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

const DEFAULT_VRSTE: string[] = [
  "spiker", "glumac", "pjevac", "dijete", "muzicar", "ostalo",
  "snimatelj", "kompozitor", "copywriter", "producent", "montazer",
  "reziser", "organizator", "account", "developer", "vidograf",
];

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function normalizeVrsta(v: any): string {
  const s = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (s) return s;
  return "ostalo";
}

async function ensureVrsteTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS sifarnik_vrste (
      vrsta_id INT NOT NULL AUTO_INCREMENT,
      sifarnik VARCHAR(80) NOT NULL,
      value_key VARCHAR(80) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      aktivan TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (vrsta_id),
      UNIQUE KEY uq_sifarnik_value (sifarnik, value_key),
      KEY idx_sifarnik_aktivan_sort (sifarnik, aktivan, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

export async function getSaradnikVrste() {
  await ensureVrsteTable();
  const rows = await query(
    `SELECT value_key
     FROM sifarnik_vrste
     WHERE sifarnik = 'saradnici_vrsta' AND aktivan = 1
     ORDER BY sort_order ASC, value_key ASC`,
  );
  const list = (rows ?? [])
    .map((r: any) => String(r.value_key || "").trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_VRSTE;
}

export async function saveSaradnikVrste(vrste: string[]) {
  await ensureVrsteTable();
  const clean = Array.from(
    new Set(
      (vrste ?? [])
        .map((v) => normalizeVrsta(v))
        .filter(Boolean),
    ),
  );
  const finalList = clean.length ? clean : DEFAULT_VRSTE;
  await query(`DELETE FROM sifarnik_vrste WHERE sifarnik = 'saradnici_vrsta'`);
  for (let i = 0; i < finalList.length; i += 1) {
    await query(
      `INSERT INTO sifarnik_vrste (sifarnik, value_key, sort_order, aktivan)
       VALUES ('saradnici_vrsta', ?, ?, 1)`,
      [finalList[i], i + 1],
    );
  }
  revalidatePath("/studio/talenti");
  return { ok: true };
}

export async function createTalent(input: {
  ime_prezime: string;
  vrsta: string;
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
  vrsta: string;
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
