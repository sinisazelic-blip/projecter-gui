// src/app/actions/finance/receivableLinks.actions.js
"use server";

import { query } from "@/lib/db";
import { mustInt, mustAllocationKm } from "./finance.validate";

async function getReceivableOrThrow(id) {
  const r = await query(
    "SELECT potrazivanje_id, iznos, projekat_id FROM projekt_potrazivanja WHERE potrazivanje_id = ? LIMIT 1",
    [id],
  );
  const row = r?.rows?.[0];
  if (!row) throw new Error("Potraživanje ne postoji.");
  return row;
}

async function getIncomeOrThrow(id) {
  const r = await query(
    "SELECT prihod_id, iznos_km FROM projektni_prihodi WHERE prihod_id = ? LIMIT 1",
    [id],
  );
  const row = r?.rows?.[0];
  if (!row) throw new Error("Prihod ne postoji.");
  return row;
}

async function getPaidSum(potrazivanje_id) {
  const r = await query(
    `
    SELECT paid_km, remaining_km, potrazuje_km
    FROM v_potrazivanja_paid_sum
    WHERE potrazivanje_id = ?
    LIMIT 1
    `,
    [potrazivanje_id],
  );
  const row = r?.rows?.[0] || {
    paid_km: 0,
    remaining_km: null,
    potrazuje_km: null,
  };
  return {
    paid_km: Number(row.paid_km) || 0,
    remaining_km: Number(row.remaining_km),
    potrazuje_km: Number(row.potrazuje_km),
  };
}

async function syncPlacenoDatum(potrazivanje_id) {
  const sums = await getPaidSum(potrazivanje_id);
  const remaining = Number.isFinite(sums.remaining_km) ? sums.remaining_km : 0;

  if (remaining <= 0.01) {
    // PAID => set placeno_datum ako nije već
    await query(
      `
      UPDATE projekt_potrazivanja
      SET placeno_datum = COALESCE(placeno_datum, CURDATE())
      WHERE potrazivanje_id = ?
      `,
      [potrazivanje_id],
    );
    return { derived_status: "PAID", ...sums };
  } else {
    // OPEN => clear placeno_datum
    await query(
      "UPDATE projekt_potrazivanja SET placeno_datum = NULL WHERE potrazivanje_id = ?",
      [potrazivanje_id],
    );
    return { derived_status: "OPEN", ...sums };
  }
}

export async function financeLinkIncomeToReceivable({
  potrazivanje_id,
  prihod_id,
  amount_km,
}) {
  const potId = mustInt("potrazivanje_id", potrazivanje_id);
  const incId = mustInt("prihod_id", prihod_id);
  const alloc = mustAllocationKm(amount_km);

  const pot = await getReceivableOrThrow(potId);
  await getIncomeOrThrow(incId);

  const cap = Math.round((Number(pot.iznos) || 0) * 100) / 100;
  if (cap <= 0)
    throw new Error(
      "Potraživanje nema iznos (iznos je NULL ili 0). Ne može se zatvarati.",
    );

  const sums = await getPaidSum(potId);
  const paid = Math.round((Number(sums.paid_km) || 0) * 100) / 100;

  if (paid + alloc > cap + 0.0001) {
    throw new Error(
      `Prekoračenje potraživanja. Već zatvoreno: ${paid.toFixed(2)} KM, traženo: ${alloc.toFixed(
        2,
      )} KM, ukupno potražuje: ${cap.toFixed(2)} KM.`,
    );
  }

  const r = await query(
    `
    INSERT INTO projekt_potrazivanje_prihod_link (potrazivanje_id, prihod_id, amount_km, aktivan)
    VALUES (?, ?, ?, 1)
    `,
    [potId, incId, alloc],
  );

  const synced = await syncPlacenoDatum(potId);

  return { ok: true, link_id: r?.insertId ?? null, synced };
}

export async function financeSetReceivableIncomeLinkActive(link_id, aktivan) {
  const id = mustInt("link_id", link_id);
  const a = aktivan ? 1 : 0;

  const r0 = await query(
    "SELECT potrazivanje_id FROM projekt_potrazivanje_prihod_link WHERE link_id = ? LIMIT 1",
    [id],
  );
  const row = r0?.rows?.[0];
  if (!row) throw new Error("Link ne postoji.");

  await query(
    "UPDATE projekt_potrazivanje_prihod_link SET aktivan = ? WHERE link_id = ?",
    [a, id],
  );

  const synced = await syncPlacenoDatum(row.potrazivanje_id);

  return { ok: true, aktivan: !!a, synced };
}

export async function financeListReceivableLinks(potrazivanje_id) {
  const potId = mustInt("potrazivanje_id", potrazivanje_id);

  const r = await query(
    `
    SELECT
      l.link_id, l.potrazivanje_id, l.prihod_id, l.amount_km, l.aktivan, l.created_at,
      p.datum_prihoda, p.iznos_km AS prihod_total_km, p.opis
    FROM projekt_potrazivanje_prihod_link l
    JOIN projektni_prihodi p ON p.prihod_id = l.prihod_id
    WHERE l.potrazivanje_id = ?
    ORDER BY l.aktivan DESC, l.link_id DESC
    `,
    [potId],
  );

  const sums = await getPaidSum(potId);

  return { ok: true, rows: r?.rows ?? [], sums };
}
