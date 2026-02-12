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
