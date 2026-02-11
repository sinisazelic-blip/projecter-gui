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
    const projekat_id = Number(body?.projekat_id); // for income meaning we need a project (use 1 for overhead)
    const opis = String(body?.opis || "");

    if (!Number.isFinite(posting_id) || posting_id <= 0)
      return bad("posting_id invalid");
    if (!Number.isFinite(amount_km) || amount_km <= 0)
      return bad("amount_km must be > 0");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum))
      return bad("datum must be YYYY-MM-DD");
    if (!Number.isFinite(projekat_id) || projekat_id <= 0)
      return bad("projekat_id invalid");

    const pRows = await query(
      `SELECT posting_id, amount, value_date, currency, counterparty, description
       FROM bank_tx_posting
       WHERE posting_id = ?`,
      [posting_id],
    );
    if (!pRows?.length) return bad("posting not found", 404);

    const posting = pRows[0];

    // Income link only allowed for incoming postings
    if (Number(posting.amount) <= 0) {
      return bad(
        "Posting is not incoming (amount <= 0); cannot link to income",
        400,
        {
          posting_amount: posting.amount,
        },
      );
    }

    // Sanity cap check
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

    // Create meaning: projektni_prihodi (your schema)
    const insInc = await query(
      `INSERT INTO projektni_prihodi
        (projekat_id, datum_prihoda, iznos_km, opis)
       VALUES
        (?, ?, ?, ?)`,
      [projekat_id, datum, amount_km, opis || posting.description || ""],
    );

    const prihod_id = insInc?.insertId ?? insInc?.rows?.insertId;
    if (!prihod_id) return bad("Failed to create prihod", 500);

    // Link posting -> prihod
    await query(
      `INSERT INTO bank_tx_posting_prihod_link
        (posting_id, prihod_id, amount_km, aktivan)
       VALUES
        (?, ?, ?, 1)`,
      [posting_id, prihod_id, amount_km],
    );

    const s2 = await query(
      `SELECT posting_id, amount, linked_income_km, linked_payment_km, linked_total_km, alloc_status
       FROM v_bank_posting_sanity
       WHERE posting_id = ?`,
      [posting_id],
    );

    return NextResponse.json({
      ok: true,
      posting_id,
      prihod_id,
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
