import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET_ENV = "FLUXA_LICENCE_EXTEND_SECRET";

/**
 * Produženje licence tenanta na osnovu uplate (portal / PayPal webhook).
 * Zahtijeva tajni ključ u headeru (Authorization: Bearer <secret> ili X-Fluxa-Licence-Extend-Secret).
 * Body: tenant_id (broj) ILI licence_token (string); subscription_ends_at (YYYY-MM-DD) ILI extend_months (broj).
 * V. PLAN_PAYMENT_EXTEND_LICENCE.md.
 */
export async function POST(req: NextRequest) {
  const secret = process.env[SECRET_ENV]?.trim();
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { ok: false, error: "LICENCE_EXTEND_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const headerSecret =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null) ||
    req.headers.get("x-fluxa-licence-extend-secret")?.trim() ||
    null;

  if (!headerSecret || headerSecret !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    tenant_id?: number;
    licence_token?: string;
    subscription_ends_at?: string;
    extend_months?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const tenantId = body.tenant_id != null ? Number(body.tenant_id) : null;
  const licenceToken =
    typeof body.licence_token === "string" ? body.licence_token.trim() || null : null;

  if ((!tenantId || !Number.isInteger(tenantId) || tenantId <= 0) && !licenceToken) {
    return NextResponse.json(
      { ok: false, error: "TENANT_ID_OR_LICENCE_TOKEN_REQUIRED" },
      { status: 400 }
    );
  }

  const exactDate =
    typeof body.subscription_ends_at === "string"
      ? body.subscription_ends_at.trim().slice(0, 10)
      : null;
  const extendMonths =
    body.extend_months != null ? Number(body.extend_months) : null;

  const hasDate = exactDate && /^\d{4}-\d{2}-\d{2}$/.test(exactDate);
  const hasExtend = Number.isInteger(extendMonths) && extendMonths! > 0;

  if (!hasDate && !hasExtend) {
    return NextResponse.json(
      { ok: false, error: "SUBSCRIPTION_ENDS_AT_OR_EXTEND_MONTHS_REQUIRED" },
      { status: 400 }
    );
  }

  try {
    const whereClause = tenantId
      ? "tenant_id = ?"
      : "licence_token = ?";
    const whereParam = tenantId ?? licenceToken;

    const rows = await query<{ tenant_id: number; subscription_ends_at: string }>(
      `SELECT tenant_id, DATE_FORMAT(subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at
       FROM tenants WHERE ${whereClause} LIMIT 1`,
      [whereParam]
    );

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404 });
    }

    let newEndsAt: string;
    if (hasDate) {
      newEndsAt = exactDate!;
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const base = row.subscription_ends_at < today ? today : row.subscription_ends_at;
      const d = new Date(base + "T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + extendMonths!);
      newEndsAt = d.toISOString().slice(0, 10);
    }

    await query(
      `UPDATE tenants SET subscription_ends_at = ?, status = 'AKTIVAN', updated_at = NOW() WHERE tenant_id = ?`,
      [newEndsAt, row.tenant_id]
    );

    return NextResponse.json({ ok: true, subscription_ends_at: newEndsAt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
