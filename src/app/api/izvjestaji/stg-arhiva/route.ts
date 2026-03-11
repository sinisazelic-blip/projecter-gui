import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ARHIVA_CUTOFF = "2025-12-31";
const YEARS_BACK = 20;

type MonthCell = {
  vrijednost: number;
  troskovi: number;
  profit: number;
};

type YearRow = {
  godina: number;
  mjeseci: Record<number, MonthCell>;
  mjeseci_arr: MonthCell[];
  ukupno_vrijednost: number;
  ukupno_troskovi: number;
  ukupno_profit: number;
};

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

export async function GET() {
  try {
    const stgTableName = await getStgTableName();
    const safeTable = stgTableName.replace(/`/g, "``");
    const params = [ARHIVA_CUTOFF, YEARS_BACK, ARHIVA_CUTOFF];

    const rows = await query(
      `
      SELECT
        YEAR(s.datum_zavrsetka) AS godina,
        MONTH(s.datum_zavrsetka) AS mjesec,
        ROUND(SUM(COALESCE(s.iznos_km, 0)), 2) AS vrijednost,
        ROUND(SUM(COALESCE(s.iznos_troska_km, 0)), 2) AS troskovi,
        ROUND(SUM(COALESCE(s.iznos_km, 0)) - SUM(COALESCE(s.iznos_troska_km, 0)), 2) AS profit
      FROM \`${safeTable}\` s
      WHERE s.datum_zavrsetka IS NOT NULL
        AND s.datum_zavrsetka >= DATE_SUB(?, INTERVAL ? YEAR)
        AND s.datum_zavrsetka <= ?
      GROUP BY YEAR(s.datum_zavrsetka), MONTH(s.datum_zavrsetka)
      ORDER BY godina ASC, mjesec ASC
      `,
      params
    );

    const byYear: Record<number, YearRow> = {};
    for (const r of Array.isArray(rows) ? rows : []) {
      const g = (r as any).godina;
      const m = (r as any).mjesec;
      if (!byYear[g]) {
        byYear[g] = {
          godina: g,
          mjeseci: {},
          mjeseci_arr: [],
          ukupno_vrijednost: 0,
          ukupno_troskovi: 0,
          ukupno_profit: 0,
        };
      }
      const vrijednost = Number((r as any).vrijednost ?? 0);
      const troskovi = Number((r as any).troskovi ?? 0);
      const profit = Number((r as any).profit ?? 0);
      byYear[g].mjeseci[m] = { vrijednost, troskovi, profit };
      byYear[g].ukupno_vrijednost += vrijednost;
      byYear[g].ukupno_troskovi += troskovi;
      byYear[g].ukupno_profit += profit;
    }

    const MJESI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const tableData = Object.values(byYear)
      .sort((a, b) => a.godina - b.godina)
      .map((row) => {
        row.mjeseci_arr = MJESI.map((m) => row.mjeseci[m] ?? { vrijednost: 0, troskovi: 0, profit: 0 });
        return row;
      });

    return NextResponse.json({
      ok: true,
      tableData,
      mjeseciNames: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
