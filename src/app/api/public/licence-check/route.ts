import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildLicenceWarnings } from "@/lib/licence-alerts/thresholds";

export const dynamic = "force-dynamic";

type LicenceCheckTenantRow = {
  tenant_id: number;
  naziv: string;
  status: string;
  soccs_tier: string | null;
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
 * Javna provjera licence za klijentsku instancu Fluxe (Bearer = `tenants.licence_token`).
 * Klijent: `LicenceCheckWrapper` i budući UI (koverta) čitaju `allowed`, `reason`, `warnings`.
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
        t.soccs_tier,
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
       WHERE t.licence_token = ?
       LIMIT 1`,
      [token],
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

    const dateOk = Number.isFinite(days) && days >= 0 && st === "AKTIVAN";
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

    return NextResponse.json({
      ok: true,
      allowed,
      reason,
      tenant_id: row.tenant_id,
      naziv: row.naziv,
      subscription_ends_at: row.subscription_ends_at,
      days_until_end: days,
      meet_remaining: meetRem,
      soccs_tier: row.soccs_tier,
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
