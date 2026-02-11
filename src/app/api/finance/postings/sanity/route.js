import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function bad(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const postingIdRaw = url.searchParams.get("posting_id");

    // If no posting_id, return last 200 rows (handy overview)
    if (!postingIdRaw) {
      const rows = await query(
        `SELECT posting_id, amount, linked_income_km, linked_payment_km, linked_total_km, alloc_status
         FROM v_bank_posting_sanity
         ORDER BY posting_id DESC
         LIMIT 200`,
      );
      return NextResponse.json({ ok: true, rows: rows || [] });
    }

    const posting_id = Number(postingIdRaw);
    if (!Number.isFinite(posting_id) || posting_id <= 0)
      return bad("posting_id invalid");

    const rows = await query(
      `SELECT posting_id, amount, linked_income_km, linked_payment_km, linked_total_km, alloc_status
       FROM v_bank_posting_sanity
       WHERE posting_id = ?`,
      [posting_id],
    );

    if (!rows?.length)
      return bad("posting not found in sanity view", 404, { posting_id });

    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (e) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
