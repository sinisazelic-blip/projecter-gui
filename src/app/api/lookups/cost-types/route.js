import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // pretpostavka: tabela tipovi_troskova(tip_id, naziv) ili slicno
    // pošto ne znam tačno ime, idemo sa tolerantnim pokušajem:
    // 1) tipovi_troskova
    // 2) sif_tipovi_troskova
    // 3) trosak_tipovi
    const candidates = [
      { table: "tipovi_troskova", id: "tip_id", name: "naziv" },
      { table: "sif_tipovi_troskova", id: "tip_id", name: "naziv" },
      { table: "trosak_tipovi", id: "tip_id", name: "naziv" },
    ];

    for (const c of candidates) {
      try {
        const rows = await query(
          `SELECT ${c.id} AS tip_id, ${c.name} AS naziv FROM ${c.table} ORDER BY ${c.name} ASC`,
        );
        if (rows && rows.length >= 0) {
          return NextResponse.json({
            success: true,
            source: c.table,
            data: rows,
          });
        }
      } catch {
        // probaj sljedeću tabelu
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Ne mogu naći tabelu tipova troškova (tipovi_troskova / sif_tipovi_troskova / trosak_tipovi).",
      },
      { status: 500 },
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
