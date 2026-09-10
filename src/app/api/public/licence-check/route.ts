import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildLicenceWarnings } from "@/lib/licence-alerts/thresholds";
import { isLiveTenantStatus } from "@/lib/tenant-licence-status";
import { defaultModulesForFluxaPosPackage, type FluxaPosBasePackageId } from "@/lib/fluxapos-activation";

export const dynamic = "force-dynamic";

type LicenceCheckTenantRow = {
  tenant_id: number;
  naziv: string;
  status: string;
  studio_licence_profile: string | null;
  soccs_tier: string | null;
  soccs_platform_scope: string | null;
  broj_blagajni: number | null;
  subscription_ends_at: string;
  days_until_end: number;
  meet_remaining: number;
};

function bearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization")?.trim() ?? "";
  const m = /^Bearer\s+(\S+)/i.exec(raw);
  return m ? m[1].trim() : null;
}

function resolveNotAllowedReason(
  status: string,
  daysUntilEnd: number,
): "suspended" | "expired" | "disabled" {
  const st = status.trim().toUpperCase();
  if (st === "SUSPENDOVAN") return "suspended";
  if (st === "ISTEKLO" || !Number.isFinite(daysUntilEnd) || daysUntilEnd < 0) {
    return "expired";
  }
  return "disabled";
}

/**
 * Javna provjera licence za klijentske instance Fluxe, EnterSYS i FluxaPOS (Bearer = `tenants.licence_token`).
 */
export async function GET(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        allowed: false,
        reason: "invalid_token",
        warnings: [],
      },
      { status: 401 },
    );
  }

  try {
    const rows = await query<LicenceCheckTenantRow>(
      `SELECT
        t.tenant_id,
        t.naziv,
        t.status,
        t.studio_licence_profile,
        t.soccs_tier,
        t.soccs_platform_scope,
        COALESCE(t.broj_blagajni, 1) AS broj_blagajni,
        DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
        DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
        (
          SELECT COUNT(*)
          FROM soccs_activation_codes sac
          WHERE sac.tenant_id = t.tenant_id
            AND sac.purpose = 'MEET_SESSION'
            AND UPPER(sac.status) = 'ISSUED'
            AND (sac.valid_until IS NULL OR sac.valid_until >= NOW())
        ) AS meet_remaining
       FROM tenants t
       WHERE t.licence_token = ? OR t.tenant_public_id = ?
       LIMIT 1`,
      [token, token],
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          allowed: false,
          reason: "invalid_token",
          warnings: [],
        },
        { status: 401 },
      );
    }

    const st = String(row.status ?? "")
      .trim()
      .toUpperCase();
    const days = Number(row.days_until_end);
    const meetRem = Number(row.meet_remaining ?? 0);
    const hasSoccs = Boolean(String(row.soccs_tier ?? "").trim());

    const dateOk = Number.isFinite(days) && days >= 0 && isLiveTenantStatus(st);
    const allowed = dateOk;

    const reason = allowed
      ? null
      : resolveNotAllowedReason(String(row.status ?? ""), days);

    const warnings = allowed
      ? buildLicenceWarnings({
          daysUntilEnd: days,
          meetRemaining: meetRem,
          hasSoccsTier: hasSoccs,
        })
      : [];

    const profile = String(row.studio_licence_profile ?? "").trim().toUpperCase();
    const scopeStr = String(row.soccs_platform_scope ?? "").trim();
    const activeScopeModules = scopeStr ? scopeStr.split(",").map((s) => s.trim()) : [];
    const hasScopeFilter = activeScopeModules.length > 0;

    let modules: Record<string, boolean>;

    if (profile === "FLUXAPOS") {
      const posPkg = (row.soccs_tier as FluxaPosBasePackageId) || "FLUXAPOS_START";
      const defaultMod = defaultModulesForFluxaPosPackage(posPkg);
      if (hasScopeFilter) {
        modules = {
          posCore: activeScopeModules.includes("posCore"),
          kdsKitchen: activeScopeModules.includes("kdsKitchen"),
          pocketWaiter: activeScopeModules.includes("pocketWaiter"),
          pantheonSync: activeScopeModules.includes("pantheonSync"),
          enterTicketing: activeScopeModules.includes("enterTicketing"),
          shiftEmail: activeScopeModules.includes("shiftEmail"),
          rfidDeposit: activeScopeModules.includes("rfidDeposit"),
        };
      } else {
        modules = defaultMod;
      }
    } else {
      modules = {
        enterCore: !hasScopeFilter || activeScopeModules.includes("enterCore"),
        poolManager: !hasScopeFilter || activeScopeModules.includes("poolManager"),
        hallManager: !hasScopeFilter || activeScopeModules.includes("hallManager"),
        fieldManager: !hasScopeFilter || activeScopeModules.includes("fieldManager"),
        gymManager: !hasScopeFilter || activeScopeModules.includes("gymManager"),
        doorMan: !hasScopeFilter || activeScopeModules.includes("doorMan"),
        lockers: !hasScopeFilter || activeScopeModules.includes("lockers"),
        rentals: !hasScopeFilter || activeScopeModules.includes("rentals"),
        mojRadio: !hasScopeFilter || activeScopeModules.includes("mojRadio"),
        mojTv: !hasScopeFilter || activeScopeModules.includes("mojTv"),
        cctvGate: !hasScopeFilter || activeScopeModules.includes("cctvGate"),
        eventManager: activeScopeModules.includes("eventManager"),
        webShop: activeScopeModules.includes("webShop"),
      };
    }

    return NextResponse.json({
      ok: true,
      allowed,
      reason,
      tenant_id: row.tenant_id,
      naziv: row.naziv,
      status: st,
      studio_licence_profile: row.studio_licence_profile,
      subscription_ends_at: row.subscription_ends_at,
      days_until_end: days,
      meet_remaining: meetRem,
      soccs_tier: row.soccs_tier,
      soccs_platform_scope: row.soccs_platform_scope,
      broj_blagajni: row.broj_blagajni ?? 1,
      modules,
      warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[licence-check]", msg);
    return NextResponse.json(
      {
        ok: false,
        allowed: true,
        reason: null,
        warnings: [],
        error: "LICENCE_CHECK_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
