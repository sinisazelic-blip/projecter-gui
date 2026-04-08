import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

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
      naziv: string;
      plan_id: number;
      plan_naziv: string;
      max_users: number;
      monthly_price: number | null;
      currency: string | null;
      soccs_tier: string | null;
      soccs_federation_parent_tenant_id: number | null;
      federation_naziv: string | null;
      subscription_starts_at: string;
      subscription_ends_at: string;
      status: string;
      days_until_end: number;
      meet_remaining: number;
      licence_token: string | null;
    }>(
      `SELECT
        t.tenant_id,
        t.tenant_public_id,
        t.naziv,
        t.plan_id,
        p.naziv AS plan_naziv,
        COALESCE(t.max_users, p.max_users) AS max_users,
        t.monthly_price,
        t.currency,
        t.soccs_tier,
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
        t.licence_token
       FROM tenants t
       JOIN plans p ON p.plan_id = t.plan_id
       LEFT JOIN tenants fp ON fp.tenant_id = t.soccs_federation_parent_tenant_id
       ORDER BY t.naziv ASC`,
    );

    return NextResponse.json({ ok: true, tenants: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

const MAX_USER_OPTIONS = [1, 3, 5, 10, 50, 101] as const; // 101 = 100+

/** Novi tenant (organizacija / kupac licence). Body: naziv, plan_id, max_users, subscription_starts_at, subscription_ends_at, monthly_price?, currency?. */
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

  const planId = Number(body?.plan_id);
  if (!Number.isInteger(planId) || planId <= 0) {
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
  const soccsTier = soccsTierRaw
    ? allowedTier.includes(soccsTierRaw)
      ? soccsTierRaw
      : "BASIC"
    : null;

  try {
    const res = await query(
      `INSERT INTO tenants (naziv, plan_id, max_users, subscription_starts_at, subscription_ends_at, status, licence_token, monthly_price, currency, tenant_public_id, soccs_tier)
       VALUES (?, ?, ?, ?, ?, 'AKTIVAN', ?, ?, ?, ?, ?)`,
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
        soccsTier,
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
