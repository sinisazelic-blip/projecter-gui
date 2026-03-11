"use server";

import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { normalizePassword } from "@/lib/auth/normalize-password";

const BCRYPT_ROUNDS = 10;
const DEFAULT_TENANT_ID = 1;

function toBit(v: any): 0 | 1 {
  return v ? 1 : 0;
}

/** Vraća max_saradnici za default tenant i broj trenutnih aktivnih saradnika. Ako tabele ne postoje, vraća null. */
async function getSaradnikLimit(): Promise<{ max: number; current: number } | null> {
  try {
    const planCol = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles'
       AND COLUMN_NAME IN ('nivo_ovlastenja', 'nivo_ovlascenja') LIMIT 1`,
    );
    const nivoCol = planCol?.[0]?.COLUMN_NAME ?? "nivo_ovlastenja";
    const tenantRows = await query<{ plan_id: number }>(
      `SELECT plan_id FROM tenants WHERE tenant_id = ? LIMIT 1`,
      [DEFAULT_TENANT_ID],
    );
    const planId = tenantRows?.[0]?.plan_id;
    if (planId == null) return null;
    const planRows = await query<{ max_saradnici: number }>(
      `SELECT max_saradnici FROM plans WHERE plan_id = ? LIMIT 1`,
      [planId],
    );
    const max = planRows?.[0]?.max_saradnici ?? 0;
    const countRows = await query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM users u
       INNER JOIN roles r ON r.role_id = u.role_id
       WHERE r.${nivoCol} = 0 AND u.aktivan = 1`,
    );
    const current = Number(countRows?.[0]?.cnt ?? 0);
    return { max, current };
  } catch {
    return null;
  }
}

/** Da li je role_id uloga Saradnik (nivo 0)? */
async function isSaradnikRole(role_id: number | null): Promise<boolean> {
  if (role_id == null) return false;
  try {
    const planCol = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles'
       AND COLUMN_NAME IN ('nivo_ovlastenja', 'nivo_ovlascenja') LIMIT 1`,
    );
    const nivoCol = planCol?.[0]?.COLUMN_NAME ?? "nivo_ovlastenja";
    const rows = await query<{ nivo: number }>(
      `SELECT ${nivoCol} AS nivo FROM roles WHERE role_id = ? LIMIT 1`,
      [role_id],
    );
    return Number(rows?.[0]?.nivo) === 0;
  } catch {
    return false;
  }
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

  const isNewSaradnik = await isSaradnikRole(role_id);
  if (isNewSaradnik) {
    const limit = await getSaradnikLimit();
    if (limit && limit.current + 1 > limit.max) {
      throw new Error(`SARADNIK_LIMIT:${limit.max}:${limit.current}`);
    }
  }

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

  const isNewSaradnik = await isSaradnikRole(role_id);
  if (isNewSaradnik) {
    const [existingUser] = await query<{ role_id: number | null }>(
      `SELECT role_id FROM users WHERE user_id = ? LIMIT 1`,
      [id],
    );
    const wasSaradnik = await isSaradnikRole(existingUser?.role_id ?? null);
    const limit = await getSaradnikLimit();
    if (limit) {
      const countAfter = limit.current - (wasSaradnik ? 1 : 0) + 1;
      if (countAfter > limit.max) {
        throw new Error(`SARADNIK_LIMIT_UPDATE:${limit.max}`);
      }
    }
  }

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
