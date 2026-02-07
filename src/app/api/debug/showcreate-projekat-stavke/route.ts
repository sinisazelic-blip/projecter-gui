import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows]: any = await pool.query("SHOW CREATE TABLE projekat_stavke");
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}
