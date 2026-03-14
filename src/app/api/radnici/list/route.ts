// GET /api/radnici/list – lista radnika za dropdown (Crew, Faze, itd.)
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `SELECT radnik_id, ime, prezime
       FROM radnici
       WHERE aktivan = 1
       ORDER BY ime, prezime ASC`,
    );
    const items = Array.isArray(rows) ? rows : [];
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
