// src/app/actions/finance/income.actions.js
"use server";

import { query } from "@/lib/db";
import { mustInt, mustDate, mustMoney, optStr, mustEnum } from "./finance.validate";

const ALLOWED_ENTITY = ["client", "other"];

export async function financeCreateProjectIncome({
  projekat_id,
  datum_prihoda,
  iznos_km,
  opis = null,
  entity_type = null,
  entity_id = null,
  iznos_original = null,
  valuta_original = null,
  kurs_u_km = null,
}) {
  const pid = mustInt("projekat_id", projekat_id);
  const d = mustDate("datum_prihoda", datum_prihoda);
  const km = mustMoney("iznos_km", iznos_km);
  const o = optStr("opis", opis, 255);

  let et = null;
  let eid = null;

  if (entity_type !== null && entity_type !== undefined && String(entity_type).trim() !== "") {
    et = mustEnum("entity_type", entity_type, ALLOWED_ENTITY);
    eid = mustInt("entity_id", entity_id);
  }

  // original fields optional
  const orig = iznos_original === null || iznos_original === undefined || String(iznos_original).trim() === ""
    ? null
    : Number(iznos_original);

  const val = valuta_original === null || valuta_original === undefined || String(valuta_original).trim() === ""
    ? null
    : String(valuta_original).trim().slice(0, 10);

  const kurs = kurs_u_km === null || kurs_u_km === undefined || String(kurs_u_km).trim() === ""
    ? null
    : Number(kurs_u_km);

  const r = await query(
    `
    INSERT INTO projektni_prihodi
      (projekat_id, datum_prihoda, opis, iznos_original, valuta_original, kurs_u_km, iznos_km, status, entity_type, entity_id)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `,
    [pid, d, o, Number.isFinite(orig) ? orig : null, val, Number.isFinite(kurs) ? kurs : null, km, et, eid]
  );

  return { ok: true, prihod_id: r?.insertId ?? null };
}

export async function financeSetIncomeStatus(prihod_id, status) {
  const id = mustInt("prihod_id", prihod_id);
  const st = mustEnum("status", status, ["ACTIVE", "STORNO"]);

  await query(
    "UPDATE projektni_prihodi SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE prihod_id = ?",
    [st, id]
  );

  return { ok: true, status: st };
}

export async function financeGetIncome(prihod_id) {
  const id = mustInt("prihod_id", prihod_id);
  const r = await query(
    `
    SELECT *
    FROM projektni_prihodi
    WHERE prihod_id = ?
    LIMIT 1
    `,
    [id]
  );
  const row = r?.rows?.[0];
  if (!row) throw new Error("Prihod ne postoji.");
  return { ok: true, row };
}
