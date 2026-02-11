import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `SELECT tip_id, naziv, requires_entity
       FROM tip_troska
       WHERE aktivan = 1
       ORDER BY naziv`,
    );
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
