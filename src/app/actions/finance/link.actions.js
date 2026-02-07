// src/app/actions/finance/link.actions.js
"use server";

import { query } from "@/lib/db";
import { mustInt, mustAllocationKm } from "./finance.validate";
import { getPostingOrThrow, getPostingAllocatedSums, abs2, signOf } from "./finance.helpers";

/**
 * Pravila:
 * - Link amount_km se čuva kao pozitivan dio posting-a.
 * - Incoming posting (amount > 0) smije linkovati samo prihod.
 * - Outgoing posting (amount < 0) smije linkovati samo placanje.
 * - Suma aktivnih linkova po posting-u ne smije preći abs(posting.amount).
 *
 * Pretpostavka: posting ima kolonu "amount" ili "amount_km".
 * U ovoj implementaciji tražimo "amount_km" prvo, fallback "amount".
 */
function postingAmount(row) {
  const n = Number(row?.amount);
  if (!Number.isFinite(n)) throw new Error("Posting nema numerički amount.");
  return Math.round(n * 100) / 100;
}


export async function financeLinkPostingToIncome({ posting_id, prihod_id, amount_km }) {
  const pid = mustInt("posting_id", posting_id);
  const iid = mustInt("prihod_id", prihod_id);
  const alloc = mustAllocationKm(amount_km);

  const posting = await getPostingOrThrow(pid);
  const amt = postingAmount(posting);

  if (signOf(amt) !== 1) {
    throw new Error("Ovaj posting nije incoming (amount > 0). Ne može se linkovati na prihod.");
  }

  const sums = await getPostingAllocatedSums(pid);
  const already = sums.linked_income_km;
  const cap = abs2(amt);

  if (already + alloc > cap + 0.0001) {
    throw new Error(`Prekoračenje split-a. Već alocirano: ${already.toFixed(2)} KM, traženo: ${alloc.toFixed(2)} KM, limit: ${cap.toFixed(2)} KM.`);
  }

  // prihod mora postojati i biti ACTIVE
  const pr = await query(
    "SELECT prihod_id, status FROM projektni_prihodi WHERE prihod_id = ? LIMIT 1",
    [iid]
  );
  if (!pr?.rows?.length) throw new Error("Prihod ne postoji.");
  if (pr.rows[0].status !== "ACTIVE") throw new Error("Prihod nije ACTIVE (storno ili nevažeći).");

  const r = await query(
    `
    INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan)
    VALUES (?, ?, ?, 1)
    `,
    [pid, iid, alloc]
  );

  return { ok: true, link_id: r?.insertId ?? null };
}

export async function financeLinkPostingToPayment({ posting_id, placanje_id, amount_km }) {
  const pid = mustInt("posting_id", posting_id);
  const payId = mustInt("placanje_id", placanje_id);
  const alloc = mustAllocationKm(amount_km);

  const posting = await getPostingOrThrow(pid);
  const amt = postingAmount(posting);

  if (signOf(amt) !== -1) {
    throw new Error("Ovaj posting nije outgoing (amount < 0). Ne može se linkovati na plaćanje.");
  }

  const sums = await getPostingAllocatedSums(pid);
  const already = sums.linked_payment_km;
  const cap = abs2(amt);

  if (already + alloc > cap + 0.0001) {
    throw new Error(`Prekoračenje split-a. Već alocirano: ${already.toFixed(2)} KM, traženo: ${alloc.toFixed(2)} KM, limit: ${cap.toFixed(2)} KM.`);
  }

  // placanje mora postojati i biti ACTIVE
  const pl = await query(
    "SELECT placanje_id, status FROM placanja WHERE placanje_id = ? LIMIT 1",
    [payId]
  );
  if (!pl?.rows?.length) throw new Error("Plaćanje ne postoji.");
  if (pl.rows[0].status !== "ACTIVE") throw new Error("Plaćanje nije ACTIVE (storno ili nevažeće).");

  const r = await query(
    `
    INSERT INTO bank_tx_posting_placanje_link (posting_id, placanje_id, amount_km, aktivan)
    VALUES (?, ?, ?, 1)
    `,
    [pid, payId, alloc]
  );

  return { ok: true, link_id: r?.insertId ?? null };
}

/**
 * “Ne brišemo” – samo deaktiviramo link.
 */
export async function financeSetIncomeLinkActive(link_id, aktivan) {
  const id = mustInt("link_id", link_id);
  const a = aktivan ? 1 : 0;

  await query(
    "UPDATE bank_tx_posting_prihod_link SET aktivan = ? WHERE link_id = ?",
    [a, id]
  );

  return { ok: true, aktivan: !!a };
}

export async function financeSetPaymentLinkActive(link_id, aktivan) {
  const id = mustInt("link_id", link_id);
  const a = aktivan ? 1 : 0;

  await query(
    "UPDATE bank_tx_posting_placanje_link SET aktivan = ? WHERE link_id = ?",
    [a, id]
  );

  return { ok: true, aktivan: !!a };
}

export async function financeListLinksForPosting(posting_id) {
  const pid = mustInt("posting_id", posting_id);

  const inc = await query(
    `
    SELECT l.link_id, l.posting_id, l.prihod_id, l.amount_km, l.aktivan, l.created_at,
           p.projekat_id, p.datum_prihoda, p.iznos_km, p.opis
    FROM bank_tx_posting_prihod_link l
    JOIN projektni_prihodi p ON p.prihod_id = l.prihod_id
    WHERE l.posting_id = ?
    ORDER BY l.aktivan DESC, l.link_id DESC
    `,
    [pid]
  );

  const pay = await query(
    `
    SELECT l.link_id, l.posting_id, l.placanje_id, l.amount_km, l.aktivan, l.created_at,
           p.projekat_id, p.datum_placanja, p.iznos_km, p.opis
    FROM bank_tx_posting_placanje_link l
    JOIN placanja p ON p.placanje_id = l.placanje_id
    WHERE l.posting_id = ?
    ORDER BY l.aktivan DESC, l.link_id DESC
    `,
    [pid]
  );

  const sums = await getPostingAllocatedSums(pid);

  return { ok: true, income_links: inc?.rows ?? [], payment_links: pay?.rows ?? [], sums };
}
