import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isLiveTenantStatus } from "@/lib/tenant-licence-status";

export const dynamic = "force-dynamic";

function bearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization")?.trim() ?? "";
  const m = /^Bearer\s+(\S+)/i.exec(raw);
  return m ? m[1].trim() : null;
}

/**
 * Endpoint za registraciju i heartbeat pojedinačne POS kase klijenta.
 * Prati broj istovremeno aktivnih kasa po tenantu i poređenje sa dozvoljenim brojem (broj_blagajni / max_kasa).
 */
export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, allowed: false, error: "UNAUTHORIZED_TOKEN" },
      { status: 401 }
    );
  }

  let body: {
    kasa_broj?: string | number;
    kasa_naziv?: string;
    app_version?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, allowed: false, error: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const kasaBroj = String(body?.kasa_broj ?? "1").trim();
  const kasaNaziv = String(body?.kasa_naziv ?? "").trim().slice(0, 128);
  const appVersion = String(body?.app_version ?? "").trim().slice(0, 32);

  try {
    const tenants = await query<{
      tenant_id: number;
      naziv: string;
      status: string;
      broj_blagajni: number | null;
      soccs_tier: string | null;
      soccs_platform_scope: string | null;
      subscription_ends_at: string;
      days_until_end: number;
    }>(
      `SELECT
        t.tenant_id,
        t.naziv,
        t.status,
        COALESCE(t.broj_blagajni, 1) AS broj_blagajni,
        t.soccs_tier,
        t.soccs_platform_scope,
        DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
        DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end
       FROM tenants t
       WHERE t.licence_token = ? OR t.tenant_public_id = ?
       LIMIT 1`,
      [token, token]
    );

    const tenant = tenants?.[0];
    if (!tenant) {
      return NextResponse.json(
        { ok: false, allowed: false, error: "TENANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const st = String(tenant.status ?? "").trim().toUpperCase();
    const days = Number(tenant.days_until_end);
    const isLive = Number.isFinite(days) && days >= 0 && isLiveTenantStatus(st);

    if (!isLive) {
      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: st === "SUSPENDOVAN" ? "suspended" : "expired",
        tenant_id: tenant.tenant_id,
        naziv: tenant.naziv,
        days_until_end: days,
        max_allowed_registers: tenant.broj_blagajni,
        active_registers_count: 0,
        message: "Licenca za ovaj objekat je istekla ili suspendovana."
      });
    }

    // 1. Zabilježi / osvježi heartbeat ove kase
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    await query(
      `INSERT INTO fluxapos_active_registers (tenant_id, kasa_broj, kasa_naziv, device_ip, app_version, last_seen)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         kasa_naziv = VALUES(kasa_naziv),
         device_ip = VALUES(device_ip),
         app_version = VALUES(app_version),
         last_seen = NOW()`,
      [tenant.tenant_id, kasaBroj, kasaNaziv, ip, appVersion]
    );

    // 2. Prebroj kase koje su bile aktivne u proteklih 15 minuta (ili danas)
    const activeRows = await query<{ cnt: number }>(
      `SELECT COUNT(DISTINCT kasa_broj) AS cnt
       FROM fluxapos_active_registers
       WHERE tenant_id = ?
         AND last_seen >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
      [tenant.tenant_id]
    );
    const activeCount = Number(activeRows?.[0]?.cnt ?? 1);
    const maxAllowed = Math.max(1, Number(tenant.broj_blagajni ?? 1));

    // Provjera limita instanci kasa
    const limitExceeded = activeCount > maxAllowed;

    return NextResponse.json({
      ok: true,
      allowed: !limitExceeded,
      reason: limitExceeded ? "register_limit_exceeded" : null,
      tenant_id: tenant.tenant_id,
      naziv: tenant.naziv,
      status: st,
      subscription_ends_at: tenant.subscription_ends_at,
      days_until_end: days,
      max_allowed_registers: maxAllowed,
      active_registers_count: activeCount,
      kasa_broj: kasaBroj,
      message: limitExceeded
        ? `Premašen je pretplaćeni broj kasa (${activeCount}/${maxAllowed}). Obratite se Fluxa podršci za proširenje paketa.`
        : null
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pos-heartbeat]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
