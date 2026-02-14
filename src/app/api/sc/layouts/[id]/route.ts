import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sc_layout_id = asInt(id);
    if (!sc_layout_id || sc_layout_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan ID layouta." },
        { status: 400 }
      );
    }

    const [layoutRows]: any = await pool.query(
      `SELECT sc_layout_id, naziv, cols, \`rows\`, created_at, updated_at
       FROM sc_layouts
       WHERE sc_layout_id = ?
       LIMIT 1`,
      [sc_layout_id]
    );

    const layout = Array.isArray(layoutRows) && layoutRows.length ? layoutRows[0] : null;
    if (!layout) {
      return NextResponse.json(
        { ok: false, error: "Layout nije pronađen." },
        { status: 404 }
      );
    }

    const [cellRows]: any = await pool.query(
      `SELECT c.sc_layout_cell_id, c.col_index, c.row_index, c.stavka_id, c.boja,
              s.naziv, s.jedinica, s.cijena_default, s.valuta_default, s.cijena_ino_eur
       FROM sc_layout_cells c
       JOIN cjenovnik_stavke s ON s.stavka_id = c.stavka_id AND s.active = 1
       WHERE c.sc_layout_id = ?
       ORDER BY c.row_index ASC, c.col_index ASC`,
      [sc_layout_id]
    );

    const cells = Array.isArray(cellRows) ? cellRows : [];

    return NextResponse.json({
      ok: true,
      layout: {
        ...layout,
        cells,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sc_layout_id = asInt(id);
    if (!sc_layout_id || sc_layout_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan ID layouta." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const naziv = String(body?.naziv ?? "").trim();
    const cols = Math.max(2, Math.min(8, asInt(body?.cols) ?? 4));
    const rows = Math.max(2, Math.min(12, asInt(body?.rows) ?? 6));
    const cells = Array.isArray(body?.cells) ? body.cells : [];

    await pool.query(
      `UPDATE sc_layouts SET naziv = ?, cols = ?, \`rows\` = ?, updated_at = NOW() WHERE sc_layout_id = ?`,
      [naziv || "Layout", cols, rows, sc_layout_id]
    );

    await pool.query(`DELETE FROM sc_layout_cells WHERE sc_layout_id = ?`, [sc_layout_id]);

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
          `INSERT INTO sc_layout_cells (sc_layout_id, col_index, row_index, stavka_id, boja) VALUES ?`,
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
