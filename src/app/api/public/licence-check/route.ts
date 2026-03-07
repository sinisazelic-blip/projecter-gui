import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Licence check za klijentske instance.
 * Klijentska Fluxa šalje LICENCE_TOKEN u Authorization: Bearer <token>.
 * Master baza ima tenants.licence_token; ako status = SUSPENDOVAN ili datum isteka prošao → allowed: false.
 * Ne zahtijeva session – ovo zovu klijentske instance (server-side).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token =
    (auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null) ||
    req.nextUrl.searchParams.get("token")?.trim() ||
    null;

  if (!token) {
    return NextResponse.json(
      { ok: true, allowed: false, reason: "missing_token" },
      { status: 200 }
    );
  }

  try {
    const rows = await query<{
      subscription_ends_at: string;
      status: string;
    }>(
      `SELECT
         DATE_FORMAT(subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
         status
       FROM tenants
       WHERE licence_token = ?
       LIMIT 1`,
      [token]
    );

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json(
        { ok: true, allowed: false, reason: "invalid_token" },
        { status: 200 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const expired = row.subscription_ends_at < today;
    const suspended = String(row.status).toUpperCase() === "SUSPENDOVAN";

    if (suspended) {
      return NextResponse.json(
        { ok: true, allowed: false, reason: "suspended" },
        { status: 200 }
      );
    }
    if (expired) {
      return NextResponse.json(
        { ok: true, allowed: false, reason: "expired" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, allowed: true },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: true, allowed: false, reason: "error", message: msg },
      { status: 200 }
    );
  }
}
