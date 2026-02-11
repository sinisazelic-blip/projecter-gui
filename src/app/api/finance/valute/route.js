import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function daysBetween(a, b) {
  // a, b su Date ili string "YYYY-MM-DD"
  const da = new Date(String(a).slice(0, 10) + "T00:00:00");
  const db = new Date(String(b).slice(0, 10) + "T00:00:00");
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim(); // optional search
    const onlyOverdue = url.searchParams.get("overdue") === "1";

    const where = [`f.status IN ('IZDATA')`];
    const args = [];

    if (onlyOverdue) {
      where.push(`f.datum_valute < CURDATE()`);
    }

    if (q) {
      // pretraga po broj_fakture/poziv/projekat_id/narucilac
      where.push(`(
        f.broj_fakture LIKE ?
        OR f.poziv_na_broj LIKE ?
        OR CAST(f.projekat_id AS CHAR) = ?
      )`);
      args.push(`%${q}%`, `%${q}%`, q);
    }

    const rows = await query(
      `
      SELECT
        f.faktura_id,
        f.projekat_id,
        f.narucilac_id,
        f.krajnji_klijent_id,
        f.broj_fakture,
        f.poziv_na_broj,
        f.datum_fakture,
        f.datum_valute,
        f.iznos_km,
        f.status,
        f.napomena_naplata,

        p.radni_naziv,
        n.naziv AS narucilac_naziv,

        CASE
          WHEN f.datum_valute < CURDATE() THEN DATEDIFF(CURDATE(), f.datum_valute)
          ELSE 0
        END AS kasni_dana,

        CASE
          WHEN f.datum_valute >= CURDATE() THEN DATEDIFF(f.datum_valute, CURDATE())
          ELSE 0
        END AS do_valute_dana
      FROM fakture f
      JOIN projekti p ON p.projekat_id = f.projekat_id
      LEFT JOIN narucioci n ON n.narucilac_id = f.narucilac_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY
        (f.datum_valute < CURDATE()) DESC,
        kasni_dana DESC,
        f.datum_valute ASC,
        f.faktura_id DESC
      LIMIT 500
      `,
      args,
    );

    return NextResponse.json({ ok: true, success: true, rows });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: e?.message || String(e),
        code: e?.code,
      },
      { status: 500 },
    );
  }
}
