import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Lista planova (za dropdown Promijeni plan). Samo kada je ENABLE_TENANT_ADMIN=true i korisnik ulogovan. */
export async function GET() {
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

  try {
    const rows = await query<{ plan_id: number; naziv: string; max_users: number }>(
      `SELECT plan_id, naziv, max_users FROM plans ORDER BY FIELD(naziv, 'Full', 'Compact', 'Light', 'Core'), plan_id ASC`
    );
    return NextResponse.json({ ok: true, plans: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
