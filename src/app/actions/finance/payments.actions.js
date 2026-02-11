// src/app/actions/finance/payments.actions.js
"use server";

import { query } from "@/lib/db";
import {
  mustInt,
  mustDate,
  mustMoney,
  optStr,
  mustEnum,
} from "./finance.validate";

const ALLOWED_ENTITY = ["vendor", "talent", "other"];

export async function financeCreatePayment({
  projekat_id,
  datum_placanja,
  iznos_km,
  opis = null,
  entity_type = null,
  entity_id = null,
}) {
  const pid = mustInt("projekat_id", projekat_id);
  const d = mustDate("datum_placanja", datum_placanja);
  const km = mustMoney("iznos_km", iznos_km);
  const o = optStr("opis", opis, 255);

  let et = null;
  let eid = null;

  if (
    entity_type !== null &&
    entity_type !== undefined &&
    String(entity_type).trim() !== ""
  ) {
    et = mustEnum("entity_type", entity_type, ALLOWED_ENTITY);
    eid = mustInt("entity_id", entity_id);
  }

  const r = await query(
    `
    INSERT INTO placanja
      (projekat_id, datum_placanja, opis, iznos_km, status, entity_type, entity_id)
    VALUES
      (?, ?, ?, ?, 'ACTIVE', ?, ?)
    `,
    [pid, d, o, km, et, eid],
  );

  return { ok: true, placanje_id: r?.insertId ?? null };
}

export async function financeSetPaymentStatus(placanje_id, status) {
  const id = mustInt("placanje_id", placanje_id);
  const st = mustEnum("status", status, ["ACTIVE", "STORNO"]);

  await query(
    "UPDATE placanja SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE placanje_id = ?",
    [st, id],
  );

  return { ok: true, status: st };
}

export async function financeGetPayment(placanje_id) {
  const id = mustInt("placanje_id", placanje_id);
  const r = await query(
    `
    SELECT *
    FROM placanja
    WHERE placanje_id = ?
    LIMIT 1
    `,
    [id],
  );
  const row = r?.rows?.[0];
  if (!row) throw new Error("Plaćanje ne postoji.");
  return { ok: true, row };
}
