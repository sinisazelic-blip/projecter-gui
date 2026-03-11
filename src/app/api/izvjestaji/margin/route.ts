import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const LIVE_FROM = "2026-01-01";
const ARHIVA_CUTOFF = "2025-12-31";
const YEARS_BACK = 20;

type MonthCell = {
  realized: number;
  troskovi: number;
  vat: number;
  profit: number;
  margin_pct: number;
};

type YearRow = {
  godina: number;
  mjeseci: Record<number, MonthCell>;
  mjeseci_arr: MonthCell[];
  avg_margin_pct: number;
};

function addRevenue(byYear: Record<number, YearRow>, r: { godina: number; mjesec: number; iznos_ukupno_km: number; osnovica_km: number; pdv_iznos_km: number }) {
  const g = r.godina;
  if (!byYear[g]) {
    byYear[g] = {
      godina: g,
      mjeseci: {},
      mjeseci_arr: [],
      avg_margin_pct: 0,
    };
  }
  const m = r.mjesec;
  if (!byYear[g].mjeseci[m]) {
    byYear[g].mjeseci[m] = { realized: 0, troskovi: 0, vat: 0, profit: 0, margin_pct: 0 };
  }
  byYear[g].mjeseci[m].realized += Number(r.iznos_ukupno_km ?? 0);
  byYear[g].mjeseci[m].vat += Number(r.pdv_iznos_km ?? 0);
}

function addCosts(byYear: Record<number, YearRow>, r: { godina: number; mjesec: number; troskovi: number }) {
  const g = r.godina;
  if (!byYear[g]) return;
  const m = r.mjesec;
  if (!byYear[g].mjeseci[m]) {
    byYear[g].mjeseci[m] = { realized: 0, troskovi: 0, vat: 0, profit: 0, margin_pct: 0 };
  }
  byYear[g].mjeseci[m].troskovi += Number(r.troskovi ?? 0);
}

export async function GET() {
  try {
    const byYear: Record<number, YearRow> = {};

    // Arhiva: stg_master_finansije — samo iznos_km, iznos_troska_km (kolone iznos_ukupno_km/iznos_sa_pdv_km ne postoje)
    try {
      const archiveRows = await query(
        `
        SELECT
          YEAR(datum_zavrsetka) AS godina,
          MONTH(datum_zavrsetka) AS mjesec,
          ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS realized,
          ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS troskovi,
          0 AS vat
        FROM stg_master_finansije
        WHERE datum_zavrsetka IS NOT NULL
          AND datum_zavrsetka >= DATE_SUB(?, INTERVAL ? YEAR)
          AND datum_zavrsetka <= ?
        GROUP BY YEAR(datum_zavrsetka), MONTH(datum_zavrsetka)
        ORDER BY godina, mjesec
        `,
        [ARHIVA_CUTOFF, YEARS_BACK, ARHIVA_CUTOFF]
      );
      for (const r of Array.isArray(archiveRows) ? archiveRows : []) {
        const g = (r as any).godina;
        const m = (r as any).mjesec;
        if (!byYear[g]) {
          byYear[g] = { godina: g, mjeseci: {}, mjeseci_arr: [], avg_margin_pct: 0 };
        }
        if (!byYear[g].mjeseci[m]) {
          byYear[g].mjeseci[m] = { realized: 0, troskovi: 0, vat: 0, profit: 0, margin_pct: 0 };
        }
        const cell = byYear[g].mjeseci[m];
        cell.realized += Number((r as any).realized ?? 0);
        cell.troskovi += Number((r as any).troskovi ?? 0);
        cell.vat += Number((r as any).vat ?? 0);
        cell.profit = cell.realized - cell.troskovi - cell.vat;
        cell.margin_pct = cell.troskovi > 0 ? (cell.profit / cell.troskovi) * 100 : 0;
      }
    } catch (archiveErr) {
      console.warn("Margin: arhiva (stg_master_finansije) nije učitana:", (archiveErr as Error)?.message);
    }

    // Od 2026: fakture (realized + VAT) i projektni_troskovi
    try {
      // Konverzija EUR u KM (1.95583) da se ne zbrajaju iznosi u različitim valutama
      const revRows = await query(
        `
        SELECT
          YEAR(datum_izdavanja) AS godina,
          MONTH(datum_izdavanja) AS mjesec,
          ROUND(SUM(
            CASE WHEN UPPER(COALESCE(valuta, 'BAM')) IN ('BAM', 'KM') THEN COALESCE(iznos_ukupno_km, 0)
            ELSE COALESCE(iznos_ukupno_km, 0) * 1.95583
            END
          ), 2) AS iznos_ukupno_km,
          ROUND(SUM(
            CASE WHEN UPPER(COALESCE(valuta, 'BAM')) IN ('BAM', 'KM') THEN COALESCE(osnovica_km, 0)
            ELSE COALESCE(osnovica_km, 0) * 1.95583
            END
          ), 2) AS osnovica_km,
          ROUND(SUM(
            CASE WHEN UPPER(COALESCE(valuta, 'BAM')) IN ('BAM', 'KM') THEN COALESCE(pdv_iznos_km, 0)
            ELSE COALESCE(pdv_iznos_km, 0) * 1.95583
            END
          ), 2) AS pdv_iznos_km
        FROM fakture
        WHERE (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
          AND datum_izdavanja >= ?
        GROUP BY YEAR(datum_izdavanja), MONTH(datum_izdavanja)
        `,
        [LIVE_FROM]
      );
      for (const r of Array.isArray(revRows) ? revRows : []) {
        addRevenue(byYear, r as any);
      }

      const costRows = await query(
        `
        SELECT
          YEAR(datum_troska) AS godina,
          MONTH(datum_troska) AS mjesec,
          ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS troskovi
        FROM projektni_troskovi
        WHERE (status IS NULL OR status <> 'STORNIRANO') AND datum_troska >= ?
        GROUP BY YEAR(datum_troska), MONTH(datum_troska)
        `,
        [LIVE_FROM]
      );
      for (const r of Array.isArray(costRows) ? costRows : []) {
        addCosts(byYear, r as any);
      }

      // Izračunaj profit i margin za sve ćelije
      for (const row of Object.values(byYear)) {
        for (const m of Object.keys(row.mjeseci)) {
          const cell = row.mjeseci[Number(m)];
          cell.profit = cell.realized - cell.troskovi - cell.vat;
          cell.margin_pct = cell.troskovi > 0 ? (cell.profit / cell.troskovi) * 100 : 0;
        }
      }
    } catch (e) {
      console.warn("Margin: live data error", (e as Error)?.message);
    }

    const tableData = Object.values(byYear).sort((a, b) => a.godina - b.godina);
    const MJESI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    for (const row of tableData) {
      row.mjeseci_arr = MJESI.map((m) => row.mjeseci[m] || { realized: 0, troskovi: 0, vat: 0, profit: 0, margin_pct: 0 });
      const cellsWithCosts = row.mjeseci_arr.filter((c) => c.troskovi > 0);
      const sumProfit = row.mjeseci_arr.reduce((s, c) => s + c.profit, 0);
      const sumCosts = row.mjeseci_arr.reduce((s, c) => s + c.troskovi, 0);
      row.avg_margin_pct = sumCosts > 0 ? (sumProfit / sumCosts) * 100 : 0;
    }

    const chartYearly = tableData.map((r) => ({
      godina: String(r.godina),
      margin: Math.round(r.avg_margin_pct * 10) / 10,
    }));

    return NextResponse.json({
      ok: true,
      tableData,
      chartYearly,
      mjeseciNames: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || "Server error" },
      { status: 500 }
    );
  }
}
