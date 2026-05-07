import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function bad(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const posting_id = Number(body?.posting_id);
    const datum = String(body?.datum || "");
    if (!Number.isFinite(posting_id) || posting_id <= 0) return bad("posting_id invalid");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return bad("datum must be YYYY-MM-DD");

    const ownerProjectIdRaw = Number(process.env.FLUXA_OWNER_PROJECT_ID ?? 1);
    const ownerProjectId = Number.isFinite(ownerProjectIdRaw) && ownerProjectIdRaw > 0 ? ownerProjectIdRaw : 1;

    const pRows = await query(
      `SELECT posting_id, amount, counterparty, description
       FROM bank_tx_posting
       WHERE posting_id = ?`,
      [posting_id],
    );
    if (!pRows?.length) return bad("posting not found", 404);
    const posting = pRows[0];
    const amount = Number(posting.amount);
    if (!(amount > 0)) return bad("Samo incoming može biti naplata starog duga.");

    const sRows = await query(
      `SELECT posting_id, amount, linked_total_km
       FROM v_bank_posting_sanity
       WHERE posting_id = ?`,
      [posting_id],
    );
    const used = Number(sRows?.[0]?.linked_total_km ?? 0);
    const cap = Math.abs(Number(sRows?.[0]?.amount ?? amount));
    const amountKm = Math.round(amount * 100) / 100;
    if (used + amountKm > cap + 0.00001) {
      return bad("Would over-allocate posting", 400, { cap, used, try_add: amountKm });
    }

    const opis = `Naplata starog duga (neidentifikovano) [posting ${posting_id}] ${String(
      posting.description || posting.counterparty || "",
    ).slice(0, 140)}`;
    const ins = await query(
      `INSERT INTO projektni_prihodi
        (projekat_id, datum_prihoda, iznos_km, opis)
       VALUES
        (?, ?, ?, ?)`,
      [ownerProjectId, datum, amountKm, opis],
    );
    const prihod_id = ins?.insertId ?? ins?.rows?.insertId;
    if (!prihod_id) return bad("Failed to create legacy debt income", 500);

    await query(
      `INSERT INTO bank_tx_posting_prihod_link
        (posting_id, prihod_id, amount_km, aktivan)
       VALUES
        (?, ?, ?, 1)`,
      [posting_id, prihod_id, amountKm],
    );
    await query(`UPDATE bank_tx_posting SET kategorija='stari_dug' WHERE posting_id=?`, [posting_id]).catch(() => {});

    return NextResponse.json({ ok: true, posting_id, prihod_id, amount_km: amountKm });
  } catch (e) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}

