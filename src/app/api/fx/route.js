import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const ccy = searchParams.get("ccy");

  if (!date || !ccy) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const rows = await query(
    `
    SELECT rate_to_bam, source
    FROM fx_rates
    WHERE rate_date = ? AND ccy = ?
    LIMIT 1
    `,
    [date, ccy.toUpperCase()]
  );

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: false, error: "not_found" });
  }

  return NextResponse.json({
    ok: true,
    rate_to_bam: Number(rows[0].rate_to_bam),
    source: rows[0].source,
  });
}
