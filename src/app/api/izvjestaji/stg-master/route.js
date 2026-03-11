import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const LIVE_FROM = "2026-01-01";

const ROUND2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

/**
 * Agregacija po godini i mjesecu.
 * Primarno: arhiva 20 godina iz stg_master_finansije (promet, troškovi, zarada po datum_zavrsetka).
 * Opciono: od 2026. dopuna iz faktura + projektni_troskovi za kontinuitet.
 */
function addToByYear(byYear, r) {
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
  const promet = ROUND2(Number(r.promet ?? 0));
  const troskovi = ROUND2(Number(r.troskovi ?? 0));
  const existing = byYear[g].mjeseci[m];
  const prevPromet = existing ? existing.promet : 0;
  const prevTroskovi = existing ? existing.troskovi : 0;
  const newPromet = prevPromet + promet;
  const newTroskovi = prevTroskovi + troskovi;
  byYear[g].mjeseci[m] = {
    promet: ROUND2(newPromet),
    troskovi: ROUND2(newTroskovi),
    zarada: ROUND2(newPromet - newTroskovi),
  };
  byYear[g].ukuno += promet;
  byYear[g].troskovi_ukuno += troskovi;
  byYear[g].zarada_ukuno = ROUND2(byYear[g].ukuno - byYear[g].troskovi_ukuno);
}

const YEARS_BACK = 20;

/** Stvarno ime tabele (zbog case-sensitivity na nekim serverima). */
async function getStgTableName() {
  try {
    const tables = await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'stg_master_finansije' LIMIT 1`
    );
    return (tables?.[0]?.TABLE_NAME ?? "stg_master_finansije");
  } catch {
    return "stg_master_finansije";
  }
}

export async function GET() {
  try {
    const cutoff = "2025-12-31";
    const byYear = {};

    // 1) Arhiva: stg_master_finansije — formula: id_po, profit = iznos_km − iznos_troska_km, završeno = datum_zavrsetka. Agregat po godini/mjesecu.
    try {
      const stgTable = await getStgTableName();
      const safeTable = String(stgTable).replace(/`/g, "``");
      const rows = await query(
        `
        SELECT
          YEAR(s.datum_zavrsetka) AS godina,
          MONTH(s.datum_zavrsetka) AS mjesec,
          ROUND(SUM(COALESCE(s.iznos_km, 0)), 2) AS promet,
          ROUND(SUM(COALESCE(s.iznos_troska_km, 0)), 2) AS troskovi,
          ROUND(SUM(COALESCE(s.iznos_km, 0)) - SUM(COALESCE(s.iznos_troska_km, 0)), 2) AS zarada
        FROM \`${safeTable}\` s
        WHERE s.datum_zavrsetka IS NOT NULL
          AND s.datum_zavrsetka >= DATE_SUB(?, INTERVAL ? YEAR)
          AND s.datum_zavrsetka <= ?
        GROUP BY YEAR(s.datum_zavrsetka), MONTH(s.datum_zavrsetka)
        ORDER BY godina ASC, mjesec ASC
        `,
        [cutoff, YEARS_BACK, cutoff]
      );
      for (const r of rows || []) addToByYear(byYear, r);
    } catch (archiveErr) {
      console.warn("stg-master: arhiva nije učitana:", archiveErr?.message);
    }

    // 2) Od 1.1.2026: redovno poslovanje — promet iz faktura, troškovi iz projektni_troskovi (za kontinuitet grafikona)
    try {
      const prometRows = await query(
        `
        SELECT
          YEAR(datum_izdavanja) AS godina,
          MONTH(datum_izdavanja) AS mjesec,
          ROUND(SUM(COALESCE(iznos_ukupno_km, 0)), 2) AS promet,
          0 AS troskovi,
          0 AS zarada
        FROM fakture
        WHERE (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
          AND datum_izdavanja >= ?
        GROUP BY YEAR(datum_izdavanja), MONTH(datum_izdavanja)
        ORDER BY godina ASC, mjesec ASC
        `,
        [LIVE_FROM]
      );
      const troskoviRows = await query(
        `
        SELECT
          YEAR(datum_troska) AS godina,
          MONTH(datum_troska) AS mjesec,
          0 AS promet,
          ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS troskovi,
          0 AS zarada
        FROM projektni_troskovi
        WHERE (status IS NULL OR status <> 'STORNIRANO')
          AND datum_troska >= ?
        GROUP BY YEAR(datum_troska), MONTH(datum_troska)
        ORDER BY godina ASC, mjesec ASC
        `,
        [LIVE_FROM]
      );
      for (const r of prometRows || []) addToByYear(byYear, r);
      for (const r of troskoviRows || []) addToByYear(byYear, r);
    } catch (liveErr) {
      console.warn("Grafički izvještaj: live podaci (od 2026) nisu učitani:", liveErr?.message);
    }
    const mjeseci = [
      "jan", "feb", "mar", "apr", "maj", "jun",
      "jul", "aug", "sep", "okt", "nov", "dec"
    ];

    const tableData = Object.values(byYear).sort((a, b) => a.godina - b.godina);

    for (const row of tableData) {
      row.mjeseci_arr = [];
      for (let m = 1; m <= 12; m++) {
        const cell = row.mjeseci[m] || { promet: 0, troskovi: 0, zarada: 0 };
        row.mjeseci_arr.push({
          promet: ROUND2(cell.promet),
          troskovi: ROUND2(cell.troskovi),
          zarada: ROUND2(cell.zarada),
        });
      }
      const cnt = row.mjeseci_arr.filter((x) => x.promet !== 0 || x.troskovi !== 0).length;
      row.broj_mjeseci = cnt;
      row.ukuno = ROUND2(row.ukuno);
      row.troskovi_ukuno = ROUND2(row.troskovi_ukuno);
      row.zarada_ukuno = ROUND2(row.zarada_ukuno);
      row.prosjek_mjesecno = ROUND2(cnt > 0 ? row.ukuno / cnt : 0);
      row.prosjek_troskovi = ROUND2(cnt > 0 ? row.troskovi_ukuno / cnt : 0);
      row.prosjek_zarada = ROUND2(cnt > 0 ? row.zarada_ukuno / cnt : 0);
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
      promet: ROUND2(r.ukuno),
      troskovi: ROUND2(r.troskovi_ukuno),
      zarada: ROUND2(r.zarada_ukuno),
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
