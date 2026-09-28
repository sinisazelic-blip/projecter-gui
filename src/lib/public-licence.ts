import { query } from "@/lib/db";
import {
  isLiveTenantStatus,
  normalizeTenantStatus,
} from "@/lib/tenant-licence-status";

export type PublicTenant = {
  tenant_id: number;
  naziv: string;
  status: string;
  days_until_end: number;
  studio_licence_profile: string | null;
  soccs_tier: string | null;
  soccs_platform_scope: string | null;
};

export type LicenceReason = "suspended" | "expired" | "disabled";

export function bearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization")?.trim() ?? "";
  const m = /^Bearer\s+(\S+)/i.exec(raw);
  return m ? m[1].trim() : null;
}

export async function loadPublicTenant(
  token: string,
): Promise<PublicTenant | null> {
  const rows = await query<PublicTenant>(
    `SELECT
      t.tenant_id,
      t.naziv,
      t.status,
      t.studio_licence_profile,
      t.soccs_tier,
      t.soccs_platform_scope,
      DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end
     FROM tenants t
     WHERE t.licence_token = ? OR t.tenant_public_id = ?
     LIMIT 1`,
    [token, token],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    tenant_id: row.tenant_id,
    naziv: row.naziv,
    status: normalizeTenantStatus(row.status),
    days_until_end: Number(row.days_until_end),
    studio_licence_profile: row.studio_licence_profile ?? null,
    soccs_tier: row.soccs_tier ?? null,
    soccs_platform_scope: row.soccs_platform_scope ?? null,
  };
}

export function licenceDecision(row: PublicTenant): {
  allowed: boolean;
  reason: LicenceReason | null;
} {
  const days = row.days_until_end;
  const allowed =
    Number.isFinite(days) && days >= 0 && isLiveTenantStatus(row.status);
  if (allowed) return { allowed: true, reason: null };
  if (row.status === "SUSPENDOVAN")
    return { allowed: false, reason: "suspended" };
  if (row.status === "ISTEKLO" || !Number.isFinite(days) || days < 0) {
    return { allowed: false, reason: "expired" };
  }
  return { allowed: false, reason: "disabled" };
}
