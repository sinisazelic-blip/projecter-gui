import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function requireTenantAdmin(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    return { error: NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 }) };
  }
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return { error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  const session = verifySessionToken(token);
  if (!session) {
    return { error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }) };
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
      naziv: string;
      plan_id: number;
      plan_naziv: string;
      max_users: number;
      subscription_starts_at: string;
      subscription_ends_at: string;
      status: string;
      days_until_end: number;
      licence_token: string | null;
    }>(
      `SELECT
        t.tenant_id,
        t.naziv,
        t.plan_id,
        p.naziv AS plan_naziv,
        p.max_users,
        DATE_FORMAT(t.subscription_starts_at, '%Y-%m-%d') AS subscription_starts_at,
        DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
        t.status,
        DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
        t.licence_token
       FROM tenants t
       JOIN plans p ON p.plan_id = t.plan_id
       ORDER BY t.naziv ASC`
    );

    return NextResponse.json({ ok: true, tenants: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** Novi tenant (organizacija / kupac licence). Body: naziv, plan_id, subscription_starts_at, subscription_ends_at. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error) return auth.error;

  let body: { naziv?: string; plan_id?: number; subscription_starts_at?: string; subscription_ends_at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const naziv = String(body?.naziv ?? "").trim();
  if (!naziv) {
    return NextResponse.json({ ok: false, error: "NAZIV_REQUIRED" }, { status: 400 });
  }

  const planId = Number(body?.plan_id);
  if (!Number.isInteger(planId) || planId <= 0) {
    return NextResponse.json({ ok: false, error: "PLAN_ID_REQUIRED" }, { status: 400 });
  }

  const startRaw = String(body?.subscription_starts_at ?? "").trim().slice(0, 10);
  const endRaw = String(body?.subscription_ends_at ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(endRaw)) {
    return NextResponse.json({ ok: false, error: "DATES_REQUIRED" }, { status: 400 });
  }

  const crypto = await import("crypto");
  const licenceToken = crypto.randomBytes(24).toString("hex");

  try {
    const res = await query(
      `INSERT INTO tenants (naziv, plan_id, subscription_starts_at, subscription_ends_at, status, licence_token)
       VALUES (?, ?, ?, ?, 'AKTIVAN', ?)`,
      [naziv, planId, startRaw, endRaw, licenceToken]
    );
    const header = Array.isArray(res) ? res[0] : res;
    const insertId = (header as { insertId?: number })?.insertId;
    return NextResponse.json({ ok: true, tenant_id: insertId ?? null, licence_token: licenceToken });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
