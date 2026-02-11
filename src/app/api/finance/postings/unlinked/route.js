import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `SELECT posting_id, value_date, amount, currency, counterparty, description
       FROM v_bank_posting_unlinked
       ORDER BY posting_id DESC`,
    );

    return NextResponse.json({ ok: true, rows: rows || [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
