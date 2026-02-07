import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function bad(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const link_id = Number(body?.link_id);

    if (!Number.isFinite(link_id) || link_id <= 0) return bad("link_id invalid");

    // Exists?
    const r = await query(
      `SELECT link_id, posting_id, placanje_id, amount_km, aktivan
       FROM bank_tx_posting_placanje_link
       WHERE link_id = ?`,
      [link_id]
    );
    if (!r?.length) return bad("link not found", 404);

    await query(
      `UPDATE bank_tx_posting_placanje_link
       SET aktivan = 0
       WHERE link_id = ?`,
      [link_id]
    );

    const r2 = await query(
      `SELECT link_id, posting_id, placanje_id, amount_km, aktivan
       FROM bank_tx_posting_placanje_link
       WHERE link_id = ?`,
      [link_id]
    );

    return NextResponse.json({ ok: true, before: r[0], after: r2?.[0] ?? null });
  } catch (e) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
