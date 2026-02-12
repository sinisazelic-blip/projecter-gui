"use server";

import { query } from "@/lib/db";

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

async function hasColumn(table: string, column: string): Promise<boolean> {
  const cols: any[] = await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column],
  );
  return (cols ?? []).length > 0;
}

/** Vraća stvarno ime kolone za nivo (nivo_ovlascenja ili nivo_ovlastenja) */
async function getNivoColumnName(): Promise<string | null> {
  const cols: any[] = await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'roles'
        AND COLUMN_NAME IN ('nivo_ovlascenja', 'nivo_ovlastenja')`,
  );
  const name = (cols ?? [])[0]?.COLUMN_NAME;
  return name ? String(name) : null;
}

export async function createRole(input: {
  naziv: string;
  nivo_ovlastenja?: number | string;
  opis?: string | null;
}) {
  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv je obavezan.");

  const nivo = cleanInt(input?.nivo_ovlastenja);
  const opis = cleanStr(input?.opis);
  const nivoCol = await getNivoColumnName();

  if (nivoCol) {
    await query(
      `INSERT INTO roles (naziv, ${nivoCol}, opis) VALUES (?,?,?)`,
      [naziv, nivo, opis],
    );
  } else {
    await query(
      `INSERT INTO roles (naziv, opis) VALUES (?,?)`,
      [naziv, opis],
    );
  }

  return { ok: true };
}

export async function updateRole(input: {
  role_id: number;
  naziv: string;
  nivo_ovlastenja?: number | string;
  opis?: string | null;
}) {
  const id = Number(input?.role_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan role_id.");

  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv je obavezan.");

  const nivo = cleanInt(input?.nivo_ovlastenja);
  const opis = cleanStr(input?.opis);
  const nivoCol = await getNivoColumnName();

  if (nivoCol) {
    await query(
      `UPDATE roles SET naziv=?, ${nivoCol}=?, opis=? WHERE role_id=?`,
      [naziv, nivo, opis, id],
    );
  } else {
    await query(
      `UPDATE roles SET naziv=?, opis=? WHERE role_id=?`,
      [naziv, opis, id],
    );
  }

  return { ok: true };
}
