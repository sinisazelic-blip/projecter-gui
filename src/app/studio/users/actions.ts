"use server";

import { query } from "@/lib/db";

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function toBit(v: any): 0 | 1 {
  return v ? 1 : 0;
}

export async function createUser(input: {
  username: string;
  password: string;
  role_id?: number | null;
  aktivan?: boolean;
}) {
  const username = String(input?.username ?? "").trim();
  if (!username) throw new Error("Korisničko ime je obavezno.");

  const password = String(input?.password ?? "").trim();
  if (!password) throw new Error("Lozinka je obavezna.");

  const role_id = input?.role_id ? Number(input.role_id) : null;
  const aktivan = toBit(input?.aktivan ?? true);

  await query(
    `INSERT INTO users (username, password, role_id, aktivan) VALUES (?,?,?,?)`,
    [username, password, role_id, aktivan],
  );

  return { ok: true };
}

export async function updateUser(input: {
  user_id: number;
  username: string;
  password?: string | null;
  role_id?: number | null;
  aktivan?: boolean;
}) {
  const id = Number(input?.user_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan user_id.");

  const username = String(input?.username ?? "").trim();
  if (!username) throw new Error("Korisničko ime je obavezno.");

  const role_id = input?.role_id ? Number(input.role_id) : null;
  const aktivan = toBit(input?.aktivan ?? true);

  const hasPassword =
    input?.password !== undefined &&
    String(input.password ?? "").trim().length > 0;
  let sql: string;
  let params: any[];

  if (hasPassword) {
    const password = String(input.password).trim();
    sql = `UPDATE users SET username=?, password=?, role_id=?, aktivan=? WHERE user_id=?`;
    params = [username, password, role_id, aktivan, id];
  } else {
    sql = `UPDATE users SET username=?, role_id=?, aktivan=? WHERE user_id=?`;
    params = [username, role_id, aktivan, id];
  }

  await query(sql, params);

  return { ok: true };
}

export async function setUserActive(input: {
  user_id: number;
  aktivan: boolean;
}) {
  const id = Number(input?.user_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan user_id.");

  await query(`UPDATE users SET aktivan=? WHERE user_id=?`, [
    input?.aktivan ? 1 : 0,
    id,
  ]);
  return { ok: true };
}
