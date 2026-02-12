import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Agregacija stg_master_finansije po godini i mjesecu.
 * Arhiva: datum_zavrsetka <= 2025-12-31
 * Kolone: iznos_km (promet), iznos_troska_km (troškovi), zarada = iznos_km - iznos_troska_km
 */
export async function GET() {
  try {
    const cutoff = "2025-12-31";

    const rows = await query(
      `
      SELECT
        YEAR(datum_zavrsetka) AS godina,
        MONTH(datum_zavrsetka) AS mjesec,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS promet,
        ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS troskovi,
        ROUND(SUM(COALESCE(iznos_km, 0)) - SUM(COALESCE(iznos_troska_km, 0)), 2) AS zarada
      FROM stg_master_finansije
      WHERE datum_zavrsetka IS NOT NULL
        AND datum_zavrsetka <= ?
      GROUP BY YEAR(datum_zavrsetka), MONTH(datum_zavrsetka)
      ORDER BY godina ASC, mjesec ASC
      `,
      [cutoff]
    );

    const byYear = {};
    const mjeseci = [
      "jan", "feb", "mar", "apr", "maj", "jun",
      "jul", "aug", "sep", "okt", "nov", "dec"
    ];

    for (const r of rows || []) {
      const g = r.godina;
      if (!byYear[g]) {
        byYear[g] = {
          godina: g,
          mjeseci: {},
          ukuno: 0,
          troskovi_ukuno: 0,
          zarada_ukuno: 0,
        };
      }
      const m = r.mjesec;
      byYear[g].mjeseci[m] = {
        promet: Number(r.promet),
        troskovi: Number(r.troskovi),
        zarada: Number(r.zarada),
      };
      byYear[g].ukuno += Number(r.promet);
      byYear[g].troskovi_ukuno += Number(r.troskovi);
      byYear[g].zarada_ukuno += Number(r.zarada);
    }

    const tableData = Object.values(byYear).sort((a, b) => a.godina - b.godina);

    for (const row of tableData) {
      row.mjeseci_arr = [];
      for (let m = 1; m <= 12; m++) {
        row.mjeseci_arr.push(row.mjeseci[m] || { promet: 0, troskovi: 0, zarada: 0 });
      }
      const cnt = row.mjeseci_arr.filter((x) => x.promet !== 0 || x.troskovi !== 0).length;
      row.broj_mjeseci = cnt;
      row.prosjek_mjesecno = cnt > 0 ? row.ukuno / cnt : 0;
      row.prosjek_troskovi = cnt > 0 ? row.troskovi_ukuno / cnt : 0;
      row.prosjek_zarada = cnt > 0 ? row.zarada_ukuno / cnt : 0;
    }

    for (let i = 1; i < tableData.length; i++) {
      const curr = tableData[i];
      const prev = tableData[i - 1];
      curr.trend =
        prev.prosjek_mjesecno > 0
          ? (curr.prosjek_mjesecno - prev.prosjek_mjesecno) / prev.prosjek_mjesecno
          : 0;
    }
    if (tableData.length) tableData[0].trend = 0;

    const chartYearly = tableData.map((r) => ({
      godina: String(r.godina),
      promet: r.ukuno,
      troskovi: r.troskovi_ukuno,
      zarada: r.zarada_ukuno,
    }));

    return NextResponse.json({
      ok: true,
      tableData,
      chartYearly,
      mjeseci,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
