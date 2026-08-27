import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db";
import {
  listEnterSysCjenovnik,
  upsertEnterSysCjenovnik,
  type EnterSysCjenovnikRow,
} from "@/lib/entersys-cjenovnik";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    return {
      error: NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 }),
    };
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  const session = verifySessionToken(token);
  if (!session) {
    return {
      error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  if (session.role_id) {
    try {
      const rows = await query<{ naziv: string }>(
        `SELECT naziv FROM roles WHERE role_id = ? LIMIT 1`,
        [session.role_id],
      );
      if (String(rows?.[0]?.naziv ?? "").toLowerCase() === "kasica") {
        return {
          error: NextResponse.json(
            { ok: false, error: "READ_ONLY_KASICA_ROLE" },
            { status: 403 },
          ),
        };
      }
    } catch {
      // ignore
    }
  }
  return { error: null };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const items = await listEnterSysCjenovnik();
    return NextResponse.json({ ok: true, items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  let body: { items?: Array<Partial<EnterSysCjenovnikRow> & { stavka_key: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ ok: false, error: "ITEMS_REQUIRED" }, { status: 400 });
  }
  try {
    await upsertEnterSysCjenovnik(items);
    const next = await listEnterSysCjenovnik();
    return NextResponse.json({ ok: true, items: next });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
