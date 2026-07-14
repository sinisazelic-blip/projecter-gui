/**
 * user_module_acl — granularna prava po korisniku.
 * Pokreni: node scripts/run-migration-user-module-acl.cjs
 */
import { query } from "@/lib/db";
import type { AclAccess, UserAclMap } from "@/lib/auth/acl-catalog";
import { ACL_MODULES } from "@/lib/auth/acl-catalog";

let tableReady: Promise<boolean> | null = null;

export async function ensureUserModuleAclTable(): Promise<boolean> {
  if (tableReady) return tableReady;
  tableReady = (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS user_module_acl (
          user_id INT NOT NULL,
          module_key VARCHAR(64) NOT NULL,
          access ENUM('none','view','edit') NOT NULL DEFAULT 'none',
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, module_key),
          KEY idx_user_module_acl_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      return true;
    } catch (e) {
      console.error("[acl] ensureUserModuleAclTable:", e);
      tableReady = null;
      return false;
    }
  })();
  return tableReady;
}

export async function getUserAclMap(userId: number): Promise<UserAclMap | null> {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const ok = await ensureUserModuleAclTable();
  if (!ok) return null;
  try {
    const rows = (await query(
      `SELECT module_key, access FROM user_module_acl WHERE user_id = ?`,
      [id],
    )) as Array<{ module_key: string; access: string }>;
    if (!rows?.length) return null;
    const map: UserAclMap = {};
    for (const r of rows) {
      const a = String(r.access ?? "none").toLowerCase();
      if (a === "view" || a === "edit" || a === "none") {
        map[String(r.module_key)] = a;
      }
    }
    return map;
  } catch {
    return null;
  }
}

/** Da li korisnik ima bar jedan ACL red (koristi se granularni režim). */
export async function userHasAclConfigured(userId: number): Promise<boolean> {
  const map = await getUserAclMap(userId);
  return map != null && Object.keys(map).length > 0;
}

export async function setUserAclMap(
  userId: number,
  acl: UserAclMap,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Neispravan user_id" };
  }
  const ok = await ensureUserModuleAclTable();
  if (!ok) return { ok: false, error: "ACL tabela nije dostupna" };

  const allowed = new Set(ACL_MODULES.map((m) => m.key));
  const entries = Object.entries(acl).filter(([k]) => allowed.has(k));

  try {
    await query(`DELETE FROM user_module_acl WHERE user_id = ?`, [id]);
    for (const [moduleKey, access] of entries) {
      const a =
        access === "edit" || access === "view" || access === "none"
          ? access
          : "none";
      await query(
        `INSERT INTO user_module_acl (user_id, module_key, access) VALUES (?, ?, ?)`,
        [id, moduleKey, a],
      );
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function applyAclTemplate(
  userId: number,
  template: UserAclMap,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const full: UserAclMap = {};
  for (const m of ACL_MODULES) {
    full[m.key] = template[m.key] ?? "none";
  }
  return setUserAclMap(userId, full);
}

export function accessToLegacyPermission(access: AclAccess): string {
  if (access === "edit") return "Edit";
  if (access === "view") return "Read Only";
  return "hide";
}
