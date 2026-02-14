// Debug: provjeri zašto lista faktura prikazuje 0 za iznose
// Otvori: /api/debug/fakture-iznosi
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Struktura tabele
    let columns: any[] = [];
    try {
      columns = await query("SHOW COLUMNS FROM fakture");
    } catch (e: any) {
      return NextResponse.json({ error: "SHOW COLUMNS failed", msg: e?.message });
    }

    // 2) Prvih 5 redova — sve kolone
    let rows: any[] = [];
    try {
      rows = await query(
        `SELECT * FROM fakture ORDER BY faktura_id DESC LIMIT 5`,
      );
    } catch (e: any) {
      return NextResponse.json({ error: "SELECT failed", msg: e?.message });
    }

    // 3) agg subquery — zbir iz projekata za prvih 5 faktura
    let aggRows: any[] = [];
    try {
      aggRows = await query(
        `SELECT fp.faktura_id,
          COALESCE(SUM(vf.budzet_planirani), 0) AS suma_osnovica,
          COALESCE(ROUND(SUM(vf.budzet_planirani) * 0.17, 2), 0) AS suma_pdv,
          COALESCE(ROUND(SUM(vf.budzet_planirani) * 1.17, 2), 0) AS suma_ukupno
         FROM faktura_projekti fp
         LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = fp.projekat_id
         GROUP BY fp.faktura_id
         LIMIT 10`,
      );
    } catch (e: any) {
      aggRows = [{ error: String((e as any)?.message) }];
    }

    return NextResponse.json({
      ok: true,
      columns: (columns as any[]).map((c) => c.Field),
      sample_rows: rows,
      agg_from_projects: aggRows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message },
      { status: 500 },
    );
  }
}
