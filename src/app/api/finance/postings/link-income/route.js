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
    const faktura_id_raw = String(body?.faktura_id ?? "").trim(); // supports internal id or business number e.g. 012/2026
    let faktura_id = Number(faktura_id_raw || 0);
    const opis = String(body?.opis || "");

    if (!Number.isFinite(posting_id) || posting_id <= 0)
      return bad("posting_id invalid");
    if (!Number.isFinite(amount_km) || amount_km <= 0)
      return bad("amount_km must be > 0");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum))
      return bad("datum must be YYYY-MM-DD");
    if (!Number.isFinite(faktura_id) || faktura_id <= 0) {
      const isBrojFormat = /^\d{1,4}\/\d{4}$/.test(faktura_id_raw);
      if (isBrojFormat) {
        const [brojRaw, godinaRaw] = faktura_id_raw.split("/");
        const brojUGodini = Number(brojRaw);
        const godina = Number(godinaRaw);
        const fRows = await query(
          `SELECT faktura_id
           FROM fakture
           WHERE broj_u_godini = ? AND godina = ?
           ORDER BY faktura_id DESC
           LIMIT 1`,
          [brojUGodini, godina],
        );
        const resolved = Number(fRows?.[0]?.faktura_id || 0);
        if (Number.isFinite(resolved) && resolved > 0) faktura_id = resolved;
      }
    }

    if ((!Number.isFinite(projekat_id) || projekat_id <= 0) && (!Number.isFinite(faktura_id) || faktura_id <= 0))
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

    const createdPrihodi = [];
    if (Number.isFinite(faktura_id) && faktura_id > 0) {
      const fpRows = await query(
        `SELECT projekat_id FROM faktura_projekti WHERE faktura_id = ? ORDER BY projekat_id ASC`,
        [faktura_id],
      );
      const projects = (fpRows || []).map((r) => Number(r.projekat_id)).filter((x) => Number.isFinite(x) && x > 0);
      if (!projects.length) return bad("Faktura nema vezane projekte", 400);

      const per = Math.floor((amount_km / projects.length) * 100) / 100;
      let remainder = Math.round((amount_km - per * projects.length) * 100) / 100;
      for (let i = 0; i < projects.length; i++) {
        const projId = projects[i];
        const extra = remainder > 0 ? 0.01 : 0;
        if (remainder > 0) remainder = Math.round((remainder - 0.01) * 100) / 100;
        const part = Math.round((per + extra) * 100) / 100;
        const insInc = await query(
          `INSERT INTO projektni_prihodi
            (projekat_id, faktura_id, datum_prihoda, iznos_km, opis)
           VALUES
            (?, ?, ?, ?, ?)`,
          [projId, faktura_id, datum, part, opis || posting.description || ""],
        );
        const prihodId = insInc?.insertId ?? insInc?.rows?.insertId;
        if (!prihodId) return bad("Failed to create prihod", 500);
        await query(
          `INSERT INTO bank_tx_posting_prihod_link
            (posting_id, prihod_id, amount_km, aktivan)
           VALUES
            (?, ?, ?, 1)`,
          [posting_id, prihodId, part],
        );
        createdPrihodi.push(prihodId);
      }
      await query(`UPDATE fakture SET fiskalni_status='PLACENA' WHERE faktura_id = ?`, [faktura_id]).catch(() => {});
    } else {
      const insInc = await query(
        `INSERT INTO projektni_prihodi
          (projekat_id, datum_prihoda, iznos_km, opis)
         VALUES
          (?, ?, ?, ?)`,
        [projekat_id, datum, amount_km, opis || posting.description || ""],
      );
      const prihod_id = insInc?.insertId ?? insInc?.rows?.insertId;
      if (!prihod_id) return bad("Failed to create prihod", 500);
      await query(
        `INSERT INTO bank_tx_posting_prihod_link
          (posting_id, prihod_id, amount_km, aktivan)
         VALUES
          (?, ?, ?, 1)`,
        [posting_id, prihod_id, amount_km],
      );
      createdPrihodi.push(prihod_id);
    }

    const s2 = await query(
      `SELECT posting_id, amount, linked_income_km, linked_payment_km, linked_total_km, alloc_status
       FROM v_bank_posting_sanity
       WHERE posting_id = ?`,
      [posting_id],
    );

    return NextResponse.json({
      ok: true,
      posting_id,
      prihod_ids: createdPrihodi,
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
