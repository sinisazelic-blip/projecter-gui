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

/** Stvarno ime tabele stg_master_finansije (zbog case-sensitivity na nekim serverima). Klijent = narucilac_id, krajnji_klijent_id (imena u tabeli klijenti). */
async function getStgTableName(): Promise<string> {
  try {
    const tables = (await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'stg_master_finansije' LIMIT 1`
    )) as { TABLE_NAME: string }[];
    return (tables ?? [])[0]?.TABLE_NAME ?? "stg_master_finansije";
  } catch {
    return "stg_master_finansije";
  }
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
    const archiveDateParams = [ARHIVA_CUTOFF, YEARS_BACK, ARHIVA_CUTOFF];

    function applyArchiveRows(rows: unknown[]) {
      for (const r of Array.isArray(rows) ? rows : []) {
        const g = (r as any).godina;
        const m = (r as any).mjesec;
        const cell = ensureCell(byYear, g, m);
        cell.realized += Number((r as any).realized ?? 0);
        cell.troskovi += Number((r as any).troskovi ?? 0);
        cell.vat += Number((r as any).vat ?? 0);
        cell.profit = cell.realized - cell.troskovi - cell.vat;
        cell.margin_pct = cell.troskovi > 0 ? (cell.profit / cell.troskovi) * 100 : 0;
      }
    }

    // Arhiva: stg_master_finansije — narucilac_id, krajnji_klijent_id (ID; imena u tabeli klijenti). Stvarno ime tabele iz baze zbog case-sensitivity.
    let archiveSource: "direct" | "join" | "none" = "none";
    let archiveRowCount = 0;
    const stgTableName = await getStgTableName();

    // stg_master_finansije ima iznos_km, iznos_troska_km, datum_zavrsetka; iznos_ukupno_km/iznos_sa_pdv_km ne postoje u svim okruženjima
    const safeTable = stgTableName.replace(/`/g, "``");
    const stgSelect = `
      SELECT
        YEAR(s.datum_zavrsetka) AS godina,
        MONTH(s.datum_zavrsetka) AS mjesec,
        ROUND(SUM(COALESCE(s.iznos_km, 0)), 2) AS realized,
        ROUND(SUM(COALESCE(s.iznos_troska_km, 0)), 2) AS troskovi,
        0 AS vat
      FROM \`${safeTable}\` s
      WHERE s.datum_zavrsetka IS NOT NULL
        AND s.datum_zavrsetka >= DATE_SUB(?, INTERVAL ? YEAR)
        AND s.datum_zavrsetka <= ?
        AND (s.narucilac_id = ? OR s.krajnji_klijent_id = ?)
      GROUP BY YEAR(s.datum_zavrsetka), MONTH(s.datum_zavrsetka)
      ORDER BY godina, mjesec
    `;
    const stgParams = [...archiveDateParams, kid, kid];
    try {
      const rows = await query(stgSelect, stgParams);
      const arr = Array.isArray(rows) ? rows : [];
      archiveRowCount = arr.length;
      applyArchiveRows(arr);
      archiveSource = "direct";
    } catch (e) {
      console.warn("Margin po klijentu: arhiva direct (narucilac_id/krajnji_klijent_id):", (e as Error)?.message);
    }

    if (archiveSource === "none") {
      try {
        const rows = await query(
          `
          SELECT
            YEAR(s.datum_zavrsetka) AS godina,
            MONTH(s.datum_zavrsetka) AS mjesec,
            ROUND(SUM(COALESCE(s.iznos_km, 0)), 2) AS realized,
            ROUND(SUM(COALESCE(s.iznos_troska_km, 0)), 2) AS troskovi,
            0 AS vat
          FROM \`${safeTable}\` s
          INNER JOIN projekti p ON (p.id_po = s.id_po OR p.projekat_id = s.id_po)
            AND (p.narucilac_id = ? OR p.krajnji_klijent_id = ?)
          WHERE s.datum_zavrsetka IS NOT NULL
            AND s.datum_zavrsetka >= DATE_SUB(?, INTERVAL ? YEAR)
            AND s.datum_zavrsetka <= ?
          GROUP BY YEAR(s.datum_zavrsetka), MONTH(s.datum_zavrsetka)
          ORDER BY godina, mjesec
          `,
          [kid, kid, ...archiveDateParams]
        );
        const arr = Array.isArray(rows) ? rows : [];
        archiveRowCount = arr.length;
        applyArchiveRows(arr);
        archiveSource = "join";
      } catch (e2) {
        console.warn("Margin po klijentu: arhiva (join projekti):", (e2 as Error)?.message);
      }
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
        INNER JOIN projekti p ON p.projekat_id = pt.projekat_id AND (p.narucilac_id = ? OR p.krajnji_klijent_id = ?)
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
      _debug: { archiveSource, archiveRowCount, stgTable: stgTableName },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || "Server error" },
      { status: 500 }
    );
  }
}
