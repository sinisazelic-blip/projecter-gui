// src/app/actions/finance/finance.helpers.js
"use server";

import { query } from "@/lib/db";

/**
 * Pročitaj posting: kanonska istina.
 * Pretpostavka: bank_tx_posting ima kolone: posting_id (PK), amount_km (ili amount), valuta, datum...
 * Ako je kod tebe ime kolone drugačije, javi i prebacim.
 */
export async function getPostingOrThrow(posting_id) {
  const r = await query(
    `
    SELECT *
    FROM bank_tx_posting
    WHERE posting_id = ?
    LIMIT 1
    `,
    [posting_id],
  );
  const row = r?.rows?.[0];
  if (!row) throw new Error("Posting ne postoji (bank_tx_posting).");
  return row;
}

/**
 * Koliko je već alocirano sa ovog posting-a (aktivni linkovi)
 */
export async function getPostingAllocatedSums(posting_id) {
  const r = await query(
    `
    SELECT linked_income_km, linked_payment_km
    FROM v_bank_posting_link_sums
    WHERE posting_id = ?
    LIMIT 1
    `,
    [posting_id],
  );
  const row = r?.rows?.[0] || { linked_income_km: 0, linked_payment_km: 0 };
  const inc = Number(row.linked_income_km) || 0;
  const pay = Number(row.linked_payment_km) || 0;
  return { linked_income_km: inc, linked_payment_km: pay };
}

export function abs2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(Math.abs(x) * 100) / 100;
}

export function signOf(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return 0;
  return x > 0 ? 1 : -1;
}
