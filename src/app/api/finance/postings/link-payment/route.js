import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function bad(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

export async function POST(req) {
  try {
    const body = await req.json();

    const posting_id = Number(body?.posting_id);
    const amount_km = Number(body?.amount_km);
    const datum = String(body?.datum || ""); // YYYY-MM-DD
    const napomena = String(body?.napomena || "");
    const referenca = String(body?.referenca || `posting_id=${posting_id}`);

    if (!Number.isFinite(posting_id) || posting_id <= 0)
      return bad("posting_id invalid");
    if (!Number.isFinite(amount_km) || amount_km <= 0)
      return bad("amount_km must be > 0");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum))
      return bad("datum must be YYYY-MM-DD");

    // 1) Load posting (bank truth)
    const pRows = await query(
      `SELECT posting_id, amount, value_date, currency, counterparty, description
       FROM bank_tx_posting
       WHERE posting_id = ?`,
      [posting_id],
    );
    if (!pRows?.length) return bad("posting not found", 404);

    const posting = pRows[0];

    // Payment link only allowed for outgoing postings
    if (Number(posting.amount) >= 0) {
      return bad(
        "Posting is not outgoing (amount >= 0); cannot link to payment",
        400,
        {
          posting_amount: posting.amount,
        },
      );
    }

    // 2) Sanity check: not over-allocate
    const sRows = await query(
      `SELECT posting_id, amount, linked_income_km, linked_payment_km, linked_total_km, alloc_status
       FROM v_bank_posting_sanity
       WHERE posting_id = ?`,
      [posting_id],
    );
    if (!sRows?.length) return bad("sanity view missing for posting", 500);

    const sanity = sRows[0];
    const cap = Math.abs(Number(sanity.amount));
    const used = Number(sanity.linked_total_km);

    if (used + amount_km > cap + 0.00001) {
      return bad("Would over-allocate posting", 400, {
        cap,
        used,
        try_add: amount_km,
      });
    }

    // 3) Create meaning: placanja (your schema has no projekat_id)
    // For BAM: original = km, kurs=1
    const insPay = await query(
      `INSERT INTO placanja
        (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
       VALUES
        (?, ?, 'BAM', 1.000000, ?, 'BANK', ?, ?)`,
      [
        datum,
        amount_km,
        amount_km,
        referenca,
        napomena || posting.description || "",
      ],
    );

    const placanje_id = insPay?.insertId ?? insPay?.rows?.insertId;
    if (!placanje_id) return bad("Failed to create placanje", 500);

    // 4) Link posting -> placanje
    const insLink = await query(
      `INSERT INTO bank_tx_posting_placanje_link
        (posting_id, placanje_id, amount_km, aktivan)
       VALUES
        (?, ?, ?, 1)`,
      [posting_id, placanje_id, amount_km],
    );

    // 5) Return updated sanity
    const s2 = await query(
      `SELECT posting_id, amount, linked_income_km, linked_payment_km, linked_total_km, alloc_status
       FROM v_bank_posting_sanity
       WHERE posting_id = ?`,
      [posting_id],
    );

    return NextResponse.json({
      ok: true,
      posting_id,
      placanje_id,
      link_inserted: true,
      sanity: s2?.[0] ?? null,
      posting: {
        amount: posting.amount,
        value_date: posting.value_date,
        counterparty: posting.counterparty,
        description: posting.description,
      },
    });
  } catch (e) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
