// GET /api/finance/bank-costs
// Sumira iznose koje banka naplaćuje (negativne transakcije: provizije, naknade, vođenje računa, prebacivanja).
// Vraća po mjesecima i ukupno po godini.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const FEE_KEYWORDS = [
  "provizija",
  "naknada",
  "fee",
  "vodjenje",
  "vodenje",
  "održavanje",
  "odrzavanje",
  "trošak naloga",
  "trosak naloga",
  "prebacivanje",
  "prenos",
  "tekući",
  "tekuci",
  "račun",
  "racun",
  "bank",
  "nalog",
  "skidanje",
  "naplata",
  "usluga",
  "odobrenje",
];

function sqlLikePattern(k) {
  const p = `%${String(k).replace(/'/g, "''")}%`;
  return `'${p}'`;
}

function buildFeeCondition() {
  const conditions = [
    "p.amount < 0",
    `(
      ${FEE_KEYWORDS.map(
        (k) =>
          `(LOWER(COALESCE(p.description,'')) LIKE ${sqlLikePattern(k)} OR LOWER(COALESCE(p.counterparty,'')) LIKE ${sqlLikePattern(k)})`
      ).join(" OR ")}
      OR LOWER(COALESCE(p.kategorija,'')) IN ('provizija','fee','naknada')
    )`,
  ];
  return conditions.join(" AND ");
}

export async function GET() {
  try {
    const feeCondition = buildFeeCondition();

    const byMonth = await query(
      `
      SELECT
        YEAR(p.value_date) AS year,
        MONTH(p.value_date) AS month,
        ROUND(SUM(ABS(p.amount)), 2) AS total_km
      FROM bank_tx_posting p
      WHERE p.value_date IS NOT NULL
        AND ${feeCondition}
      GROUP BY YEAR(p.value_date), MONTH(p.value_date)
      ORDER BY year ASC, month ASC
      `
    );

    const rows = Array.isArray(byMonth) ? byMonth : byMonth?.rows ?? [];

    const byYear = {};
    for (const r of rows) {
      const y = String(r.year ?? "");
      if (!byYear[y]) byYear[y] = 0;
      byYear[y] += Number(r.total_km) || 0;
    }
    for (const y of Object.keys(byYear)) {
      byYear[y] = Math.round(byYear[y] * 100) / 100;
    }

    return NextResponse.json({
      ok: true,
      byMonth: rows.map((r) => ({
        year: r.year,
        month: r.month,
        total_km: Number(r.total_km) || 0,
      })),
      byYear,
    });
  } catch (e) {
    console.error("[bank-costs]", e?.message);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}
