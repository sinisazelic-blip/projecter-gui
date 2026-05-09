import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db";
import {
  normalizeStudioLicenceProfile,
  STUDIO_STUB_NO_FLUXA_PLAN_NAZIV,
} from "@/lib/studio-licence-profile";

export const dynamic = "force-dynamic";

function isMissingSoccsPlatformColumnsError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return (
    msg.includes("soccs_platform_role") || msg.includes("soccs_platform_scope")
  );
}

function requireTenantAdmin(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    return {
      error: NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      ),
    };
  }
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return {
      error: NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }
  const session = verifySessionToken(token);
  if (!session) {
    return {
      error: NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }
  return { error: null };
}

/** Lista tenanata (organizacija / kupaca licence). Samo kada je ENABLE_TENANT_ADMIN=true i korisnik ulogovan. */
export async function GET() {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error) return auth.error;

  try {
    const rows = await query<{
      tenant_id: number;
      tenant_public_id: string | null;
      studio_licence_profile: string | null;
      billing_email: string | null;
      billing_phone: string | null;
      last_licence_alert_at: string | null;
      last_licence_alert_key: string | null;
      naziv: string;
      plan_id: number;
      plan_naziv: string;
      max_users: number;
      monthly_price: number | null;
      currency: string | null;
      soccs_tier: string | null;
      soccs_platform_role: string | null;
      soccs_platform_scope: string | null;
      soccs_federation_parent_tenant_id: number | null;
      federation_naziv: string | null;
      subscription_starts_at: string;
      subscription_ends_at: string;
      status: string;
      days_until_end: number;
      meet_remaining: number;
      licence_token: string | null;
      soccs_first_install_consumed: number;
    }>(
      `SELECT
        t.tenant_id,
        t.tenant_public_id,
        t.studio_licence_profile,
        t.billing_email,
        t.billing_phone,
        DATE_FORMAT(t.last_licence_alert_at, '%Y-%m-%d %H:%i:%s') AS last_licence_alert_at,
        t.last_licence_alert_key,
        t.naziv,
        t.plan_id,
        p.naziv AS plan_naziv,
        COALESCE(t.max_users, p.max_users) AS max_users,
        t.monthly_price,
        t.currency,
        t.soccs_tier,
        t.soccs_platform_role,
        t.soccs_platform_scope,
        t.soccs_federation_parent_tenant_id,
        fp.naziv AS federation_naziv,
        DATE_FORMAT(t.subscription_starts_at, '%Y-%m-%d') AS subscription_starts_at,
        DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
        t.status,
        DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
        (
          SELECT COUNT(*)
          FROM soccs_activation_codes sac
          WHERE sac.tenant_id = t.tenant_id
            AND sac.purpose = 'MEET_SESSION'
            AND UPPER(sac.status) = 'ISSUED'
            AND (sac.valid_until IS NULL OR sac.valid_until >= NOW())
        ) AS meet_remaining,
        t.licence_token,
        (
          SELECT CASE WHEN EXISTS (
            SELECT 1 FROM soccs_activation_codes s2
            WHERE s2.tenant_id = t.tenant_id
              AND s2.purpose = 'FIRST_INSTALL'
              AND s2.consumed_installation_id IS NOT NULL
          ) THEN 1 ELSE 0 END
        ) AS soccs_first_install_consumed
       FROM tenants t
       JOIN plans p ON p.plan_id = t.plan_id
       LEFT JOIN tenants fp ON fp.tenant_id = t.soccs_federation_parent_tenant_id
       ORDER BY t.naziv ASC`,
    );

    return NextResponse.json({ ok: true, tenants: rows ?? [] });
  } catch (e: unknown) {
    if (isMissingSoccsPlatformColumnsError(e)) {
      const rows = await query<{
        tenant_id: number;
        tenant_public_id: string | null;
        studio_licence_profile: string | null;
        billing_email: string | null;
        billing_phone: string | null;
        last_licence_alert_at: string | null;
        last_licence_alert_key: string | null;
        naziv: string;
        plan_id: number;
        plan_naziv: string;
        max_users: number;
        monthly_price: number | null;
        currency: string | null;
        soccs_tier: string | null;
        soccs_platform_role: string | null;
        soccs_platform_scope: string | null;
        soccs_federation_parent_tenant_id: number | null;
        federation_naziv: string | null;
        subscription_starts_at: string;
        subscription_ends_at: string;
        status: string;
        days_until_end: number;
        meet_remaining: number;
        licence_token: string | null;
        soccs_first_install_consumed: number;
      }>(
        `SELECT
          t.tenant_id,
          t.tenant_public_id,
          t.studio_licence_profile,
          t.billing_email,
          t.billing_phone,
          DATE_FORMAT(t.last_licence_alert_at, '%Y-%m-%d %H:%i:%s') AS last_licence_alert_at,
          t.last_licence_alert_key,
          t.naziv,
          t.plan_id,
          p.naziv AS plan_naziv,
          COALESCE(t.max_users, p.max_users) AS max_users,
          t.monthly_price,
          t.currency,
          t.soccs_tier,
          NULL AS soccs_platform_role,
          NULL AS soccs_platform_scope,
          t.soccs_federation_parent_tenant_id,
          fp.naziv AS federation_naziv,
          DATE_FORMAT(t.subscription_starts_at, '%Y-%m-%d') AS subscription_starts_at,
          DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
          t.status,
          DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
          (
            SELECT COUNT(*)
            FROM soccs_activation_codes sac
            WHERE sac.tenant_id = t.tenant_id
              AND sac.purpose = 'MEET_SESSION'
              AND UPPER(sac.status) = 'ISSUED'
              AND (sac.valid_until IS NULL OR sac.valid_until >= NOW())
          ) AS meet_remaining,
          t.licence_token,
          (
            SELECT CASE WHEN EXISTS (
              SELECT 1 FROM soccs_activation_codes s2
              WHERE s2.tenant_id = t.tenant_id
                AND s2.purpose = 'FIRST_INSTALL'
                AND s2.consumed_installation_id IS NOT NULL
            ) THEN 1 ELSE 0 END
          ) AS soccs_first_install_consumed
         FROM tenants t
         JOIN plans p ON p.plan_id = t.plan_id
         LEFT JOIN tenants fp ON fp.tenant_id = t.soccs_federation_parent_tenant_id
         ORDER BY t.naziv ASC`,
      );
      return NextResponse.json({ ok: true, tenants: rows ?? [] });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

const MAX_USER_OPTIONS = [1, 3, 5, 10, 50, 101] as const; // 101 = 100+

/** Novi tenant. Body uključuje studio_licence_profile (čarobnjak): FLUXA_ONLY | SOCCS_SWIMVOICE | FLUXA_AND_SOCCS. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error) return auth.error;

  let body: {
    naziv?: string;
    plan_id?: number;
    max_users?: number;
    subscription_starts_at?: string;
    subscription_ends_at?: string;
    monthly_price?: number | string | null;
    currency?: string | null;
    soccs_tier?: string | null;
    soccs_platform_role?: string | null;
    soccs_platform_scope?: string | null;
    studio_licence_profile?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const naziv = String(body?.naziv ?? "").trim();
  if (!naziv) {
    return NextResponse.json(
      { ok: false, error: "NAZIV_REQUIRED" },
      { status: 400 },
    );
  }

  const profile = normalizeStudioLicenceProfile(
    String(body?.studio_licence_profile ?? ""),
  );
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "STUDIO_LICENCE_PROFILE_REQUIRED" },
      { status: 400 },
    );
  }

  let planId = Number(body?.plan_id);
  if (profile === "SOCCS_SWIMVOICE") {
    const stubRows = await query<{ plan_id: number }>(
      `SELECT plan_id FROM plans WHERE naziv = ? LIMIT 1`,
      [STUDIO_STUB_NO_FLUXA_PLAN_NAZIV],
    );
    const stubId = stubRows[0]?.plan_id;
    if (!stubId) {
      return NextResponse.json(
        {
          ok: false,
          error: "STUB_FLUXA_PLAN_MISSING",
          hint: "Pokreni scripts/sql/alter-tenants-studio-licence-profile.sql na bazi.",
        },
        { status: 500 },
      );
    }
    planId = stubId;
  } else if (!Number.isInteger(planId) || planId <= 0) {
    return NextResponse.json(
      { ok: false, error: "PLAN_ID_REQUIRED" },
      { status: 400 },
    );
  }

  const maxUsers = body?.max_users != null ? Number(body.max_users) : 5;
  if (
    !MAX_USER_OPTIONS.includes(maxUsers as (typeof MAX_USER_OPTIONS)[number])
  ) {
    const valid = MAX_USER_OPTIONS.join(", ");
    return NextResponse.json(
      { ok: false, error: "MAX_USERS_INVALID", valid },
      { status: 400 },
    );
  }

  const startRaw = String(body?.subscription_starts_at ?? "")
    .trim()
    .slice(0, 10);
  const endRaw = String(body?.subscription_ends_at ?? "")
    .trim()
    .slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startRaw) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endRaw)
  ) {
    return NextResponse.json(
      { ok: false, error: "DATES_REQUIRED" },
      { status: 400 },
    );
  }

  const rawPrice = body?.monthly_price;
  const monthlyPrice =
    rawPrice != null && rawPrice !== "" ? Number(rawPrice) : null;
  const currency =
    typeof body?.currency === "string"
      ? body.currency.trim().slice(0, 3) || null
      : null;

  const crypto = await import("node:crypto");
  const licenceToken = crypto.randomBytes(24).toString("hex");
  const tenantPublicId = crypto.randomUUID();
  const soccsTierRaw =
    body?.soccs_tier != null
      ? String(body.soccs_tier).trim().toUpperCase()
      : "";
  const allowedTier = [
    "BASIC",
    "BASIC_PLUS",
    "PROFESSIONAL",
    "ENTERPRISE",
    "SWIMVOICE",
  ];
  let soccsTier: string | null = null;
  if (profile === "FLUXA_ONLY") {
    soccsTier = null;
  } else if (profile === "SOCCS_SWIMVOICE") {
    if (!soccsTierRaw || !allowedTier.includes(soccsTierRaw)) {
      return NextResponse.json(
        { ok: false, error: "SOCCS_TIER_REQUIRED" },
        { status: 400 },
      );
    }
    soccsTier = soccsTierRaw;
  } else {
    if (soccsTierRaw && allowedTier.includes(soccsTierRaw)) {
      soccsTier = soccsTierRaw;
    } else {
      soccsTier = null;
    }
  }

  const platformRoleRaw =
    body?.soccs_platform_role != null
      ? String(body.soccs_platform_role).trim().toUpperCase()
      : "";
  const platformRoleAllowed = ["OWNER", "AMBASSADOR"];
  let soccsPlatformRole = platformRoleRaw
    ? platformRoleAllowed.includes(platformRoleRaw)
      ? platformRoleRaw
      : null
    : null;
  const scopeRaw =
    body?.soccs_platform_scope != null
      ? String(body.soccs_platform_scope).trim()
      : "";
  let soccsPlatformScope = scopeRaw || null;

  if (profile === "FLUXA_ONLY") {
    soccsPlatformRole = null;
    soccsPlatformScope = null;
  }

  try {
    const res = await query(
      `INSERT INTO tenants (naziv, plan_id, max_users, subscription_starts_at, subscription_ends_at, status, licence_token, monthly_price, currency, tenant_public_id, studio_licence_profile, soccs_tier, soccs_platform_role, soccs_platform_scope)
       VALUES (?, ?, ?, ?, ?, 'AKTIVAN', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        naziv,
        planId,
        maxUsers,
        startRaw,
        endRaw,
        licenceToken,
        monthlyPrice ?? null,
        currency,
        tenantPublicId,
        profile,
        soccsTier,
        soccsPlatformRole,
        soccsPlatformScope,
      ],
    );
    const header = Array.isArray(res) ? res[0] : res;
    const insertId = (header as { insertId?: number })?.insertId;
    return NextResponse.json({
      ok: true,
      tenant_id: insertId ?? null,
      licence_token: licenceToken,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
