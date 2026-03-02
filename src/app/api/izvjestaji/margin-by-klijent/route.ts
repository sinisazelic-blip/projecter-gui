import { NextRequest, NextResponse } from "next/server";
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

function ensureCell(byYear: Record<number, YearRow>, g: number, m: number): MonthCell {
  if (!byYear[g]) {
    byYear[g] = { godina: g, mjeseci: {}, mjeseci_arr: [], avg_margin_pct: 0 };
  }
  if (!byYear[g].mjeseci[m]) {
    byYear[g].mjeseci[m] = { realized: 0, troskovi: 0, vat: 0, profit: 0, margin_pct: 0 };
  }
  return byYear[g].mjeseci[m];
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const klijentId = url.searchParams.get("klijent_id");
    const kid = klijentId ? Number(klijentId) : null;
    if (!Number.isFinite(kid) || kid <= 0) {
      return NextResponse.json({ ok: false, error: "klijent_id obavezan" }, { status: 400 });
    }

    const byYear: Record<number, YearRow> = {};

    // Arhiva: stg_master_finansije po klijentu — ista logika kao Charts, 20 godina unazad
    try {
      const archiveRows = await query(
        `
        SELECT
          YEAR(datum_zavrsetka) AS godina,
          MONTH(datum_zavrsetka) AS mjesec,
          ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS realized,
          ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS troskovi,
          ROUND(SUM(COALESCE(iznos_ukupno_km, iznos_sa_pdv_km, iznos_km)) - SUM(COALESCE(iznos_km, 0)), 2) AS vat
        FROM stg_master_finansije
        WHERE datum_zavrsetka IS NOT NULL
          AND datum_zavrsetka >= DATE_SUB(?, INTERVAL ? YEAR)
          AND datum_zavrsetka <= ?
          AND (COALESCE(narucilac_id, krajnji_klijent_id) = ?)
        GROUP BY YEAR(datum_zavrsetka), MONTH(datum_zavrsetka)
        ORDER BY godina, mjesec
        `,
        [ARHIVA_CUTOFF, YEARS_BACK, ARHIVA_CUTOFF, kid]
      );
      for (const r of Array.isArray(archiveRows) ? archiveRows : []) {
        const g = (r as any).godina;
        const m = (r as any).mjesec;
        const cell = ensureCell(byYear, g, m);
        cell.realized += Number((r as any).realized ?? 0);
        cell.troskovi += Number((r as any).troskovi ?? 0);
        cell.vat += Number((r as any).vat ?? 0);
        cell.profit = cell.realized - cell.troskovi - cell.vat;
        cell.margin_pct = cell.troskovi > 0 ? (cell.profit / cell.troskovi) * 100 : 0;
      }
    } catch (archiveErr) {
      console.warn("Margin po klijentu: arhiva (stg_master_finansije) nije učitana:", (archiveErr as Error)?.message);
    }

    // Od 2026: fakture (bill_to_klijent_id) i troškovi po projektima tog klijenta
    try {
      const revRows = await query(
        `
        SELECT
          YEAR(datum_izdavanja) AS godina,
          MONTH(datum_izdavanja) AS mjesec,
          ROUND(SUM(COALESCE(iznos_ukupno_km, 0)), 2) AS iznos_ukupno_km,
          ROUND(SUM(COALESCE(pdv_iznos_km, 0)), 2) AS pdv_iznos_km
        FROM fakture
        WHERE (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
          AND datum_izdavanja >= ?
          AND bill_to_klijent_id = ?
        GROUP BY YEAR(datum_izdavanja), MONTH(datum_izdavanja)
        `,
        [LIVE_FROM, kid]
      );
      for (const r of Array.isArray(revRows) ? revRows : []) {
        const g = (r as any).godina;
        const m = (r as any).mjesec;
        const cell = ensureCell(byYear, g, m);
        cell.realized += Number((r as any).iznos_ukupno_km ?? 0);
        cell.vat += Number((r as any).pdv_iznos_km ?? 0);
      }

      const costRows = await query(
        `
        SELECT
          YEAR(pt.datum_troska) AS godina,
          MONTH(pt.datum_troska) AS mjesec,
          ROUND(SUM(COALESCE(pt.iznos_km, 0)), 2) AS troskovi
        FROM projektni_troskovi pt
        INNER JOIN projekti p ON p.projekt_id = pt.projekt_id AND (p.narucilac_id = ? OR p.krajnji_klijent_id = ?)
        WHERE (pt.status IS NULL OR pt.status <> 'STORNIRANO') AND pt.datum_troska >= ?
        GROUP BY YEAR(pt.datum_troska), MONTH(pt.datum_troska)
        `,
        [kid, kid, LIVE_FROM]
      );
      for (const r of Array.isArray(costRows) ? costRows : []) {
        const g = (r as any).godina;
        const m = (r as any).mjesec;
        const cell = ensureCell(byYear, g, m);
        cell.troskovi += Number((r as any).troskovi ?? 0);
      }

      for (const row of Object.values(byYear)) {
        for (const m of Object.keys(row.mjeseci)) {
          const cell = row.mjeseci[Number(m)];
          cell.profit = cell.realized - cell.troskovi - cell.vat;
          cell.margin_pct = cell.troskovi > 0 ? (cell.profit / cell.troskovi) * 100 : 0;
        }
      }
    } catch (e) {
      console.warn("Margin by klijent: live data error", (e as Error)?.message);
    }

    const tableData = Object.values(byYear).sort((a, b) => a.godina - b.godina);
    const MJESI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    for (const row of tableData) {
      row.mjeseci_arr = MJESI.map((m) => row.mjeseci[m] || { realized: 0, troskovi: 0, vat: 0, profit: 0, margin_pct: 0 });
      const cellsWithActivity = row.mjeseci_arr.filter((c) => c.realized > 0 || c.troskovi > 0);
      const sumProfit = cellsWithActivity.reduce((s, c) => s + c.profit, 0);
      const sumCosts = cellsWithActivity.reduce((s, c) => s + c.troskovi, 0);
      row.avg_margin_pct = sumCosts > 0 ? (sumProfit / sumCosts) * 100 : 0;
    }

    const chartYearly = tableData.map((r) => ({
      godina: String(r.godina),
      margin: Math.round(r.avg_margin_pct * 10) / 10,
    }));

    const klijentRows = (await query(
      `SELECT klijent_id, naziv_klijenta FROM klijenti WHERE klijent_id = ?`,
      [kid]
    )) as { klijent_id: number; naziv_klijenta: string }[];
    const klijentNaziv = klijentRows?.[0]?.naziv_klijenta ?? "—";

    return NextResponse.json({
      ok: true,
      tableData,
      chartYearly,
      klijent_id: kid,
      klijent_naziv: klijentNaziv,
      mjeseciNames: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || "Server error" },
      { status: 500 }
    );
  }
}
