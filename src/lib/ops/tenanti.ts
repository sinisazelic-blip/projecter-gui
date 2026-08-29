import { query } from "@/lib/db";
import {
  ENTERSYS_BASE_PACKAGES,
  ENTERSYS_MODULE_KEYS,
  isEnterSysBasePackageId,
  resolveEnterSysBasePackageId,
} from "@/lib/entersys-activation";
import {
  calculateEnterSysMonthly,
  ensureEnterSysCjenovnikTable,
  listEnterSysCjenovnik,
} from "@/lib/entersys-cjenovnik";
import { ensureOpsTables } from "@/lib/ops/schema";

export type EnterTenantRow = {
  tenant_id: number;
  naziv: string;
  status: string;
  subscription_starts_at: string;
  subscription_ends_at: string;
  days_until_end: number;
  monthly_price: number | null;
  currency: string | null;
  broj_blagajni: number;
  soccs_tier: string | null;
  soccs_platform_scope: string | null;
  package_id: string | null;
  package_label: string | null;
  modules: string[];
};

export type EnterTenantAuditRow = {
  audit_id: number;
  tenant_id: number;
  tenant_naziv: string | null;
  actor_user_id: number;
  actor_username: string;
  action: string;
  detail: string | null;
  created_at: string;
};

const ENTERSYS_PACKAGE_IDS = ENTERSYS_BASE_PACKAGES.map((p) => p.id);

function isEnterSysRow(row: {
  studio_licence_profile?: string | null;
  soccs_tier?: string | null;
}): boolean {
  const profile = String(row.studio_licence_profile ?? "")
    .trim()
    .toUpperCase();
  if (profile === "ENTERSYS" || profile === "POOL_MANAGER") return true;
  return isEnterSysBasePackageId(String(row.soccs_tier ?? ""));
}

function mapTenant(row: {
  tenant_id: number;
  naziv: string;
  status: string;
  subscription_starts_at: string;
  subscription_ends_at: string;
  days_until_end: number;
  monthly_price: number | null;
  currency: string | null;
  broj_blagajni: number | null;
  studio_licence_profile?: string | null;
  soccs_tier: string | null;
  soccs_platform_scope: string | null;
}): EnterTenantRow {
  const packageId = resolveEnterSysBasePackageId(row);
  const pkg = ENTERSYS_BASE_PACKAGES.find((p) => p.id === packageId) ?? null;
  const modules = String(row.soccs_platform_scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    tenant_id: row.tenant_id,
    naziv: row.naziv,
    status: row.status,
    subscription_starts_at: row.subscription_starts_at,
    subscription_ends_at: row.subscription_ends_at,
    days_until_end: Number(row.days_until_end ?? 0),
    monthly_price:
      row.monthly_price == null ? null : Number(row.monthly_price),
    currency: row.currency,
    broj_blagajni: Number(row.broj_blagajni ?? 1),
    soccs_tier: row.soccs_tier,
    soccs_platform_scope: row.soccs_platform_scope,
    package_id: pkg?.id ?? null,
    package_label: pkg?.label ?? null,
    modules,
  };
}

export async function listEnterTenants(): Promise<EnterTenantRow[]> {
  await ensureOpsTables();
  try {
    const rows = await query<{
      tenant_id: number;
      naziv: string;
      status: string;
      subscription_starts_at: string;
      subscription_ends_at: string;
      days_until_end: number;
      monthly_price: number | null;
      currency: string | null;
      broj_blagajni: number | null;
      studio_licence_profile: string | null;
      soccs_tier: string | null;
      soccs_platform_scope: string | null;
    }>(
      `SELECT
        t.tenant_id,
        t.naziv,
        t.status,
        DATE_FORMAT(t.subscription_starts_at, '%Y-%m-%d') AS subscription_starts_at,
        DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
        DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
        t.monthly_price,
        t.currency,
        COALESCE(t.broj_blagajni, 1) AS broj_blagajni,
        t.studio_licence_profile,
        t.soccs_tier,
        t.soccs_platform_scope
       FROM tenants t
       WHERE UPPER(COALESCE(t.studio_licence_profile, '')) IN ('ENTERSYS', 'POOL_MANAGER')
          OR t.soccs_tier IN (${ENTERSYS_PACKAGE_IDS.map(() => "?").join(", ")})
       ORDER BY t.naziv ASC`,
      ENTERSYS_PACKAGE_IDS,
    );
    return (rows ?? []).filter(isEnterSysRow).map(mapTenant);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/studio_licence_profile|unknown column/i.test(msg)) return [];
    try {
      const rows = await query<{
        tenant_id: number;
        naziv: string;
        status: string;
        subscription_starts_at: string;
        subscription_ends_at: string;
        days_until_end: number;
        monthly_price: number | null;
        currency: string | null;
        broj_blagajni: number | null;
        soccs_tier: string | null;
        soccs_platform_scope: string | null;
      }>(
        `SELECT
          t.tenant_id,
          t.naziv,
          t.status,
          DATE_FORMAT(t.subscription_starts_at, '%Y-%m-%d') AS subscription_starts_at,
          DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
          DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
          t.monthly_price,
          t.currency,
          COALESCE(t.broj_blagajni, 1) AS broj_blagajni,
          t.soccs_tier,
          t.soccs_platform_scope
         FROM tenants t
         WHERE t.soccs_tier IN (${ENTERSYS_PACKAGE_IDS.map(() => "?").join(", ")})
         ORDER BY t.naziv ASC`,
        ENTERSYS_PACKAGE_IDS,
      );
      return (rows ?? []).filter(isEnterSysRow).map(mapTenant);
    } catch {
      return [];
    }
  }
}

export async function getEnterTenant(
  tenantId: number,
): Promise<EnterTenantRow | null> {
  const all = await listEnterTenants();
  return all.find((t) => t.tenant_id === tenantId) ?? null;
}

export async function listEnterTenantAudit(
  limit = 40,
): Promise<EnterTenantAuditRow[]> {
  await ensureOpsTables();
  try {
    return await query<EnterTenantAuditRow>(
      `SELECT
        a.audit_id,
        a.tenant_id,
        t.naziv AS tenant_naziv,
        a.actor_user_id,
        a.actor_username,
        a.action,
        a.detail,
        DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i') AS created_at
       FROM ops_tenant_audit a
       LEFT JOIN tenants t ON t.tenant_id = a.tenant_id
       ORDER BY a.audit_id DESC
       LIMIT ?`,
      [limit],
    );
  } catch {
    return [];
  }
}

async function writeAudit(input: {
  tenantId: number;
  actorUserId: number;
  actorUsername: string;
  action: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  await ensureOpsTables();
  await query(
    `INSERT INTO ops_tenant_audit
      (tenant_id, actor_user_id, actor_username, action, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.tenantId,
      input.actorUserId,
      input.actorUsername.slice(0, 80),
      input.action.slice(0, 32),
      JSON.stringify(input.detail),
    ],
  );
}

export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

export async function extendEnterTenant(input: {
  tenantId: number;
  endsAt: string;
  actorUserId: number;
  actorUsername: string;
}): Promise<EnterTenantRow> {
  const current = await getEnterTenant(input.tenantId);
  if (!current) throw new Error("TENANT_NOT_FOUND");
  const endsAt = input.endsAt.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsAt)) throw new Error("INVALID_DATE");

  const today = new Date().toISOString().slice(0, 10);
  const status = String(current.status).toUpperCase();
  const nextStatus = status === "ISTEKLO" ? "AKTIVAN" : current.status;

  await query(
    `UPDATE tenants
     SET subscription_ends_at = ?, status = ?, updated_at = NOW()
     WHERE tenant_id = ?`,
    [endsAt, nextStatus, input.tenantId],
  );
  await writeAudit({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorUsername: input.actorUsername,
    action: "EXTEND",
    detail: {
      from: current.subscription_ends_at,
      to: endsAt,
      status_from: current.status,
      status_to: nextStatus,
      today,
    },
  });
  const next = await getEnterTenant(input.tenantId);
  if (!next) throw new Error("TENANT_NOT_FOUND");
  return next;
}

export async function updateEnterTenantModules(input: {
  tenantId: number;
  packageId: string;
  modules: string[];
  brojBlagajni?: number;
  actorUserId: number;
  actorUsername: string;
}): Promise<EnterTenantRow> {
  const current = await getEnterTenant(input.tenantId);
  if (!current) throw new Error("TENANT_NOT_FOUND");
  if (!isEnterSysBasePackageId(input.packageId)) {
    throw new Error("INVALID_PACKAGE");
  }

  const allowed = new Set<string>(ENTERSYS_MODULE_KEYS.map((m) => m.key));
  const modules = Array.from(
    new Set(input.modules.map((k) => String(k).trim()).filter((k) => allowed.has(k))),
  );
  if (!modules.includes("enterCore")) modules.unshift("enterCore");

  const broj =
    input.brojBlagajni != null &&
    Number.isInteger(input.brojBlagajni) &&
    input.brojBlagajni > 0
      ? input.brojBlagajni
      : current.broj_blagajni;

  await ensureEnterSysCjenovnikTable();
  const catalog = await listEnterSysCjenovnik();
  const isPilot = String(current.status).toUpperCase() === "PILOT";
  const calc = calculateEnterSysMonthly({
    packageId: input.packageId,
    moduleKeys: modules,
    currency: current.currency,
    catalog,
  });

  await query(
    `UPDATE tenants
     SET soccs_tier = ?,
         soccs_platform_scope = ?,
         broj_blagajni = ?,
         monthly_price = ?,
         updated_at = NOW()
     WHERE tenant_id = ?`,
    [
      input.packageId,
      modules.join(","),
      broj,
      isPilot ? 0 : calc.total,
      input.tenantId,
    ],
  );
  await writeAudit({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorUsername: input.actorUsername,
    action: "MODULES",
    detail: {
      package_from: current.package_id,
      package_to: input.packageId,
      modules_from: current.modules,
      modules_to: modules,
      blagajni_from: current.broj_blagajni,
      blagajni_to: broj,
      price_to: isPilot ? 0 : calc.total,
    },
  });
  const next = await getEnterTenant(input.tenantId);
  if (!next) throw new Error("TENANT_NOT_FOUND");
  return next;
}
