import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db";

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

/** Lista aktivacijskih kodova; opciono ?tenant_id= */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error) return auth.error;

  const tenantIdRaw = req.nextUrl.searchParams.get("tenant_id");
  const tenantId = tenantIdRaw != null ? Number(tenantIdRaw) : null;

  try {
    if (tenantId != null && Number.isInteger(tenantId) && tenantId > 0) {
      const rows = await query(
        `SELECT
           c.id,
           c.tenant_id,
           c.sponsor_tenant_id,
           c.code,
           c.purpose,
           c.status,
           DATE_FORMAT(c.valid_from, '%Y-%m-%d') AS valid_from,
           DATE_FORMAT(c.valid_until, '%Y-%m-%d') AS valid_until,
           c.max_uses,
           c.uses_count,
           c.consumed_installation_id,
           c.meet_note
         FROM soccs_activation_codes c
         WHERE c.tenant_id = ?
         ORDER BY c.id DESC`,
        [tenantId],
      );
      return NextResponse.json({ ok: true, codes: rows ?? [] });
    }

    const rows = await query(
      `SELECT
         c.id,
         c.tenant_id,
         t.naziv AS tenant_naziv,
         c.sponsor_tenant_id,
         c.code,
         c.purpose,
         c.status,
         DATE_FORMAT(c.valid_from, '%Y-%m-%d') AS valid_from,
         DATE_FORMAT(c.valid_until, '%Y-%m-%d') AS valid_until,
         c.max_uses,
         c.uses_count,
         c.consumed_installation_id,
         c.meet_note
       FROM soccs_activation_codes c
       JOIN tenants t ON t.tenant_id = c.tenant_id
       ORDER BY c.id DESC
       LIMIT 500`,
    );
    return NextResponse.json({ ok: true, codes: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Generiši kod: body tenant_id, purpose FIRST_INSTALL|MEET_SESSION,
 * sponsor_tenant_id (obavezno za meet ako postoji savez), valid_days?, meet_note?
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error) return auth.error;

  let body: {
    tenant_id?: number;
    purpose?: string;
    sponsor_tenant_id?: number | null;
    valid_days?: number | null;
    meet_note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const tenantId = Number(body?.tenant_id);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return NextResponse.json(
      { ok: false, error: "TENANT_ID_REQUIRED" },
      { status: 400 },
    );
  }

  const purpose = String(body?.purpose ?? "")
    .trim()
    .toUpperCase();
  if (purpose !== "FIRST_INSTALL" && purpose !== "MEET_SESSION") {
    return NextResponse.json(
      { ok: false, error: "INVALID_PURPOSE" },
      { status: 400 },
    );
  }

  const sponsorRaw = body?.sponsor_tenant_id;
  let sponsorTenantId: number | null = null;
  if (sponsorRaw != null) {
    const n = Number(sponsorRaw);
    if (Number.isInteger(n) && n > 0) sponsorTenantId = n;
  }

  if (purpose === "MEET_SESSION" && sponsorTenantId != null) {
    if (!Number.isInteger(sponsorTenantId) || sponsorTenantId <= 0) {
      return NextResponse.json(
        { ok: false, error: "INVALID_SPONSOR" },
        { status: 400 },
      );
    }
    if (sponsorTenantId === tenantId) {
      return NextResponse.json(
        { ok: false, error: "SPONSOR_CANNOT_MATCH_TENANT" },
        { status: 400 },
      );
    }
  }
  if (purpose === "FIRST_INSTALL" && sponsorTenantId != null) {
    return NextResponse.json(
      { ok: false, error: "SPONSOR_ONLY_FOR_MEET" },
      { status: 400 },
    );
  }

  const validDays =
    body?.valid_days != null ? Number(body.valid_days) : 365 * 5;
  const days =
    Number.isFinite(validDays) && validDays > 0
      ? Math.min(validDays, 365 * 20)
      : 365 * 5;

  const meetNote =
    typeof body?.meet_note === "string"
      ? body.meet_note.trim().slice(0, 255) || null
      : null;

  const code = randomBytes(18).toString("hex");

  try {
    await query(
      `INSERT INTO soccs_activation_codes
        (tenant_id, sponsor_tenant_id, code, purpose, status, valid_from, valid_until, max_uses, meet_note)
       VALUES (?, ?, ?, ?, 'ISSUED', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 1, ?)`,
      [
        tenantId,
        purpose === "MEET_SESSION" ? sponsorTenantId : null,
        code,
        purpose,
        days,
        meetNote,
      ],
    );
    return NextResponse.json({ ok: true, code, purpose });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
