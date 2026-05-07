// GET /api/finance/bank-costs
// Sumira iznose koje banka naplaćuje (negativne transakcije: provizije, naknade, vođenje računa, prebacivanja).
// Vraća po mjesecima i ukupno po godini.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const FEE_KEYWORDS = [
  "provizija",
  "naknada",
  "naknade",
  "gpp naknade",
  "fee",
  "vodjenje",
  "vodenje",
  "vođenje",
  "održavanje",
  "odrzavanje",
  "odrzavanje racuna",
  "održavanje računa",
  "trošak naloga",
  "trosak naloga",
];

const NON_FEE_HINTS = [
  "kredit",
  "rata",
  "pdv",
  "porez",
  "fiskal",
  "isplata",
  "uplata",
  "prenos",
  "stari dug",
];

function sqlLikePattern(k) {
  const p = `%${String(k).replace(/'/g, "''")}%`;
  return `'${p}'`;
}

function buildFeeCondition() {
  const feeTextExpr =
    "LOWER(CONCAT(COALESCE(p.description,''), ' ', COALESCE(p.counterparty,'')))";
  const conditions = [
    "p.amount < 0",
    `LOWER(COALESCE(p.kategorija,'')) NOT IN ('kredit','pdv','porez','fiskalne','stari_dug')`,
    `(
      ${FEE_KEYWORDS.map((k) => `${feeTextExpr} LIKE ${sqlLikePattern(k)}`).join(" OR ")}
    )`,
    `(
      ${NON_FEE_HINTS.map(
        (k) =>
          `${feeTextExpr} NOT LIKE ${sqlLikePattern(k)}`
      ).join(" AND ")}
    )`,
    `NOT (
      ${feeTextExpr} LIKE '%naknada za usluge%'
      AND TRIM(COALESCE(p.counterparty,'')) <> ''
    )`,
  ];
  return conditions.join(" AND ");
}

export async function GET(req) {
  try {
    const feeCondition = buildFeeCondition();
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";
    const debugYear = Number(searchParams.get("year"));
    const debugMonth = Number(searchParams.get("month"));

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

    const payload = {
      ok: true,
      byMonth: rows.map((r) => ({
        year: r.year,
        month: r.month,
        total_km: Number(r.total_km) || 0,
      })),
      byYear,
    };

    if (debug && Number.isFinite(debugYear) && Number.isFinite(debugMonth)) {
      const detailRows = await query(
        `
        SELECT
          p.posting_id,
          DATE(p.value_date) AS value_date,
          ROUND(ABS(p.amount), 2) AS amount_km,
          p.kategorija,
          p.counterparty,
          p.description
        FROM bank_tx_posting p
        WHERE p.value_date IS NOT NULL
          AND YEAR(p.value_date) = ?
          AND MONTH(p.value_date) = ?
          AND ${feeCondition}
        ORDER BY p.value_date ASC, p.posting_id ASC
        `,
        [debugYear, debugMonth]
      );
      const details = Array.isArray(detailRows) ? detailRows : detailRows?.rows ?? [];
      payload.debug = {
        year: debugYear,
        month: debugMonth,
        count: details.length,
        rows: details.map((r) => ({
          posting_id: r.posting_id,
          value_date: r.value_date,
          amount_km: Number(r.amount_km) || 0,
          kategorija: r.kategorija || "",
          counterparty: r.counterparty || "",
          description: r.description || "",
        })),
      };
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[bank-costs]", e?.message);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}
