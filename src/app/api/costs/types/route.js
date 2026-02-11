import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `
      SELECT tip_id AS id, naziv AS name, requires_entity
      FROM tip_troska
      WHERE aktivan = 1
      ORDER BY naziv
      `,
    );
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
