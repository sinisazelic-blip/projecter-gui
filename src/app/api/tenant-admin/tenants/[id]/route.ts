import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Produži pretplatu ili promijeni plan tenanta. Samo kada je ENABLE_TENANT_ADMIN=true i korisnik ulogovan. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const MAX_USER_OPTIONS = [1, 3, 5, 10, 50, 101];
  let body: {
    subscription_ends_at?: string;
    plan_id?: number;
    status?: string;
    regenerate_licence_token?: boolean;
    max_users?: number;
    monthly_price?: number | null;
    currency?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const updates: string[] = [];
  const paramsList: (string | number | null)[] = [];
  let newLicenceToken: string | undefined;

  if (body.regenerate_licence_token === true) {
    const crypto = await import("crypto");
    newLicenceToken = crypto.randomBytes(24).toString("hex");
    updates.push("licence_token = ?");
    paramsList.push(newLicenceToken);
  }

  if (body.subscription_ends_at != null) {
    const d = String(body.subscription_ends_at).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      updates.push("subscription_ends_at = ?");
      paramsList.push(d);
    }
  }
  if (body.plan_id != null) {
    const planId = Number(body.plan_id);
    if (Number.isInteger(planId) && planId > 0) {
      updates.push("plan_id = ?");
      paramsList.push(planId);
    }
  }
  if (body.max_users != null && MAX_USER_OPTIONS.includes(Number(body.max_users))) {
    updates.push("max_users = ?");
    paramsList.push(Number(body.max_users));
  }
  if (body.monthly_price !== undefined) {
    updates.push("monthly_price = ?");
    paramsList.push(body.monthly_price == null || body.monthly_price === "" ? null : Number(body.monthly_price));
  }
  if (body.currency !== undefined) {
    updates.push("currency = ?");
    paramsList.push(typeof body.currency === "string" ? body.currency.trim().slice(0, 3) || null : null);
  }
  if (body.status != null) {
    const s = String(body.status).trim().toUpperCase();
    if (s === "SUSPENDOVAN" || s === "AKTIVAN" || s === "ISTEKLO") {
      updates.push("status = ?");
      paramsList.push(s);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: false, error: "NO_VALID_UPDATES" }, { status: 400 });
  }

  paramsList.push(id);

  try {
    await query(
      `UPDATE tenants SET ${updates.join(", ")}, updated_at = NOW() WHERE tenant_id = ?`,
      paramsList
    );
    const out: { ok: boolean; licence_token?: string } = { ok: true };
    if (newLicenceToken) out.licence_token = newLicenceToken;
    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
