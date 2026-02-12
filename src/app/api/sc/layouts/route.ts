import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `SELECT sc_layout_id, naziv, cols, \`rows\`, created_at, updated_at
       FROM sc_layouts
       ORDER BY naziv ASC
       LIMIT 15`
    );

    return NextResponse.json({
      ok: true,
      rows: Array.isArray(rows) ? rows : [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const naziv = String(body?.naziv ?? "").trim();
    const cols = Math.max(2, Math.min(8, asInt(body?.cols) ?? 4));
    const rows = Math.max(2, Math.min(12, asInt(body?.rows) ?? 6));
    const cells = Array.isArray(body?.cells) ? body.cells : [];

    if (!naziv) {
      return NextResponse.json(
        { ok: false, error: "Naziv layouta je obavezan." },
        { status: 400 }
      );
    }

    const [ins]: any = await pool.query(
      `INSERT INTO sc_layouts (naziv, cols, \`rows\`) VALUES (?, ?, ?)`,
      [naziv, cols, rows]
    );

    const sc_layout_id = Number(ins?.insertId ?? 0);
    if (!sc_layout_id) {
      return NextResponse.json(
        { ok: false, error: "Greška pri kreiranju layouta." },
        { status: 500 }
      );
    }

    if (cells.length > 0) {
      const vals: any[] = [];
      for (const c of cells) {
        const col = asInt(c.col_index) ?? 0;
        const row = asInt(c.row_index) ?? 0;
        const sid = asInt(c.stavka_id);
        const boja = String(c?.boja ?? "#7dd3fc").slice(0, 20);
        if (sid && sid > 0) {
          vals.push([sc_layout_id, col, row, sid, boja]);
        }
      }
      if (vals.length > 0) {
        await pool.query(
          `INSERT INTO sc_layout_cells (sc_layout_id, col_index, row_index, stavka_id, boja)
           VALUES ?`,
          [vals]
        );
      }
    }

    return NextResponse.json({ ok: true, sc_layout_id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}
