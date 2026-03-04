"use server";

import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { normalizePassword } from "@/lib/auth/normalize-password";

const BCRYPT_ROUNDS = 10;

function toBit(v: any): 0 | 1 {
  return v ? 1 : 0;
}

export async function createUser(input: {
  username: string;
  password: string;
  role_id?: number | null;
  aktivan?: boolean;
  radnik_id?: number | null;
}) {
  const username = String(input?.username ?? "").trim();
  if (!username) throw new Error("Korisničko ime je obavezno.");

  const password = String(input?.password ?? "").trim();
  if (!password) throw new Error("Lozinka je obavezna.");

  const role_id = input?.role_id ? Number(input.role_id) : null;
  const aktivan = toBit(input?.aktivan ?? true);
  const radnik_id =
    input?.radnik_id != null && Number(input.radnik_id) > 0
      ? Number(input.radnik_id)
      : null;

  const passwordNorm = normalizePassword(password);
  const passwordHash = await bcrypt.hash(passwordNorm, BCRYPT_ROUNDS);

  await query(
    `INSERT INTO users (username, password, role_id, aktivan, radnik_id) VALUES (?,?,?,?,?)`,
    [username, passwordHash, role_id, aktivan, radnik_id],
  );

  return { ok: true };
}

export async function updateUser(input: {
  user_id: number;
  username: string;
  password?: string | null;
  role_id?: number | null;
  aktivan?: boolean;
  radnik_id?: number | null;
}) {
  const id = Number(input?.user_id);
  if (!Number.isFinite(id) || id <= 0)
    throw new Error("Neispravan user_id.");

  const username = String(input?.username ?? "").trim();
  if (!username) throw new Error("Korisničko ime je obavezno.");

  const role_id = input?.role_id ? Number(input.role_id) : null;
  const aktivan = toBit(input?.aktivan ?? true);
  const radnik_id =
    input?.radnik_id != null && Number(input.radnik_id) > 0
      ? Number(input.radnik_id)
      : null;

  const hasPassword =
    input?.password !== undefined &&
    String(input.password ?? "").trim().length > 0;
  let sql: string;
  let params: any[];

  if (hasPassword) {
    const passwordNorm = normalizePassword(String(input.password).trim());
    const passwordHash = await bcrypt.hash(passwordNorm, BCRYPT_ROUNDS);
    sql = `UPDATE users SET username=?, password=?, role_id=?, aktivan=?, radnik_id=? WHERE user_id=?`;
    params = [username, passwordHash, role_id, aktivan, radnik_id, id];
  } else {
    sql = `UPDATE users SET username=?, role_id=?, aktivan=?, radnik_id=? WHERE user_id=?`;
    params = [username, role_id, aktivan, radnik_id, id];
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
