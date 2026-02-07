import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const batch_id = Number(req.nextUrl.searchParams.get("batch_id") || "");
  if (!Number.isFinite(batch_id) || batch_id <= 0) {
    return NextResponse.json({ ok: false, error: "batch_id is required" }, { status: 400 });
  }

  const rows = await query(
    `
    SELECT
      s.tx_id,
      DATE_FORMAT(s.value_date, '%Y-%m-%d') AS value_date,
      s.amount,
      s.currency,
      s.counterparty,
      s.description,
      s.is_fee,
      s.fee_for_reference
    FROM bank_tx_staging s
    LEFT JOIN bank_tx_match m ON m.tx_id = s.tx_id
    WHERE s.batch_id = ?
      AND m.tx_id IS NULL
    ORDER BY s.tx_id ASC
    `,
    [batch_id]
  );

  return NextResponse.json({ ok: true, batch_id, unmatched: rows });
}
