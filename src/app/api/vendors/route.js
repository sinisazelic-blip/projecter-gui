import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `
      SELECT dobavljac_id AS id, naziv AS name
      FROM dobavljaci
      WHERE aktivan = 1
      ORDER BY naziv
      `
    );
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Greška" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, message: "Nedostaje naziv dobavljača" }, { status: 400 });
    }

    const r = await query(
      `INSERT INTO dobavljaci (naziv, aktivan) VALUES (?, 1)`,
      [name]
    );

    return NextResponse.json({ ok: true, id: r.insertId, name });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Greška" }, { status: 500 });
  }
}
