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

export async function createRole(input: {
  naziv: string;
  nivo_ovlastenja?: number | string;
  opis?: string | null;
}) {
  const naziv = String(input?.naziv ?? "").trim();
  if (!naziv) throw new Error("Naziv je obavezan.");

  const nivo_ovlastenja = cleanInt(input?.nivo_ovlastenja);
  const opis = cleanStr(input?.opis);
  const hasNivo = await hasColumn("roles", "nivo_ovlastenja");

  if (hasNivo) {
    await query(
      `INSERT INTO roles (naziv, nivo_ovlastenja, opis) VALUES (?,?,?)`,
      [naziv, nivo_ovlastenja, opis],
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

  const nivo_ovlastenja = cleanInt(input?.nivo_ovlastenja);
  const opis = cleanStr(input?.opis);
  const hasNivo = await hasColumn("roles", "nivo_ovlastenja");

  if (hasNivo) {
    await query(
      `UPDATE roles SET naziv=?, nivo_ovlastenja=?, opis=? WHERE role_id=?`,
      [naziv, nivo_ovlastenja, opis, id],
    );
  } else {
    await query(
      `UPDATE roles SET naziv=?, opis=? WHERE role_id=?`,
      [naziv, opis, id],
    );
  }

  return { ok: true };
}
