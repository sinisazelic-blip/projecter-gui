import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT klijent_id AS id, naziv_klijenta AS naziv
       FROM klijenti
       ORDER BY naziv_klijenta`
    );

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}
