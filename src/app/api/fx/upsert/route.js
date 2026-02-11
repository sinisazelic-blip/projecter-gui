import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const { date, ccy, rate_to_bam, source = "manual" } = body;

    if (!date || !ccy || !Number.isFinite(Number(rate_to_bam))) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload" },
        { status: 400 },
      );
    }

    await query(
      `
      INSERT INTO fx_rates (rate_date, ccy, rate_to_bam, source)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rate_to_bam = VALUES(rate_to_bam),
        source = VALUES(source)
      `,
      [date, ccy.toUpperCase(), rate_to_bam, source],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("fx/upsert error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 },
    );
  }
}
