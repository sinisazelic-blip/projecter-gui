// src/app/actions/inventory/movements.actions.js
"use server";

import { query } from "@/lib/db";
import {
  assertEnum,
  assertQtyPositive,
  assertMovementAt,
  assertOptionalStr,
} from "./inventory.validate";

const ALLOWED_TYPES = ["IN", "OUT", "ADJUST"];

/**
 * Interno: pročitaj trenutno stanje iz VIEW-a
 */
async function getBalance(item_id, location_id) {
  const r = await query(
    `
    SELECT qty_balance
    FROM v_inventory_balance
    WHERE item_id = ? AND location_id = ?
    LIMIT 1
    `,
    [item_id, location_id],
  );
  const row = r?.rows?.[0];
  const n =
    row?.qty_balance === null || row?.qty_balance === undefined
      ? 0
      : Number(row.qty_balance);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/**
 * Interno: provjeri da item i lokacija postoje i da su aktivni
 */
async function assertActiveItemAndLocation(item_id, location_id) {
  const it = await query(
    "SELECT item_id, aktivan FROM inventory_items WHERE item_id = ? LIMIT 1",
    [item_id],
  );
  if (!it?.rows?.length) throw new Error("Artikal ne postoji.");
  if (!it.rows[0].aktivan) throw new Error("Artikal je deaktiviran.");

  const loc = await query(
    "SELECT location_id, aktivan FROM inventory_locations WHERE location_id = ? LIMIT 1",
    [location_id],
  );
  if (!loc?.rows?.length) throw new Error("Lokacija ne postoji.");
  if (!loc.rows[0].aktivan) throw new Error("Lokacija je deaktivirana.");
}

/**
 * Kanonski upis kretanja
 * - qty je uvijek pozitivan broj
 * - OUT provjerava da ne ide ispod nule (po item+location)
 */
export async function inventoryPostMovement({
  item_id,
  location_id,
  movement_type,
  qty,
  movement_at = null,
  projekat_id = null,
  ref_note = null,
  created_by = null,
}) {
  const itemId = Number(item_id);
  const locId = Number(location_id);

  if (!Number.isInteger(itemId) || itemId <= 0)
    throw new Error("Neispravan item_id.");
  if (!Number.isInteger(locId) || locId <= 0)
    throw new Error("Neispravan location_id.");

  const type = assertEnum("movement_type", movement_type, ALLOWED_TYPES);
  const q = assertQtyPositive(qty);
  const at = assertMovementAt(movement_at);
  const note = assertOptionalStr("Napomena", ref_note, 255);
  const who = assertOptionalStr("created_by", created_by, 120);

  let projId = null;
  if (
    projekat_id !== null &&
    projekat_id !== undefined &&
    String(projekat_id).trim() !== ""
  ) {
    const n = Number(projekat_id);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error("Neispravan projekat_id.");
    projId = n;
  }

  await assertActiveItemAndLocation(itemId, locId);

  if (type === "OUT") {
    const bal = await getBalance(itemId, locId);
    if (bal - q < -0.0005) {
      throw new Error(
        `Nema dovoljno stanja za izlaz. Trenutno: ${bal.toFixed(3)}, traženo: ${q.toFixed(3)}.`,
      );
    }
  }

  const r = await query(
    `
    INSERT INTO inventory_movements
      (item_id, location_id, movement_type, qty, movement_at, projekat_id, ref_note, created_by)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [itemId, locId, type, q, at, projId, note, who],
  );

  return { ok: true, movement_id: r?.insertId ?? null };
}

/**
 * TRANSFER helper (A -> B)
 * Upisuje 2 kretanja: OUT iz from_location, IN u to_location.
 * Napomena: radi sekvencijalno (bez eksplicitnog DB transaction helpera).
 * Ako ikad uvedemo withTransaction u @/lib/db, ovo ćemo odmah prebaciti na atomarni upis.
 */
export async function inventoryTransfer({
  item_id,
  from_location_id,
  to_location_id,
  qty,
  movement_at = null,
  projekat_id = null,
  ref_note = null,
  created_by = null,
}) {
  const itemId = Number(item_id);
  const fromId = Number(from_location_id);
  const toId = Number(to_location_id);

  if (!Number.isInteger(itemId) || itemId <= 0)
    throw new Error("Neispravan item_id.");
  if (!Number.isInteger(fromId) || fromId <= 0)
    throw new Error("Neispravan from_location_id.");
  if (!Number.isInteger(toId) || toId <= 0)
    throw new Error("Neispravan to_location_id.");
  if (fromId === toId)
    throw new Error("Transfer: from i to lokacija ne smiju biti iste.");

  const q = assertQtyPositive(qty);
  const at = assertMovementAt(movement_at);
  const note = assertOptionalStr("Napomena", ref_note, 255);
  const who = assertOptionalStr("created_by", created_by, 120);

  let projId = null;
  if (
    projekat_id !== null &&
    projekat_id !== undefined &&
    String(projekat_id).trim() !== ""
  ) {
    const n = Number(projekat_id);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error("Neispravan projekat_id.");
    projId = n;
  }

  // aktivni item + lokacije
  await assertActiveItemAndLocation(itemId, fromId);
  await assertActiveItemAndLocation(itemId, toId);

  // provjeri stanje na from lokaciji
  const bal = await getBalance(itemId, fromId);
  if (bal - q < -0.0005) {
    throw new Error(
      `Nema dovoljno stanja za transfer. Trenutno: ${bal.toFixed(3)}, traženo: ${q.toFixed(3)}.`,
    );
  }

  const outRef = note ? `TRANSFER OUT: ${note}` : "TRANSFER OUT";
  const inRef = note ? `TRANSFER IN: ${note}` : "TRANSFER IN";

  const r1 = await query(
    `
    INSERT INTO inventory_movements
      (item_id, location_id, movement_type, qty, movement_at, projekat_id, ref_note, created_by)
    VALUES
      (?, ?, 'OUT', ?, ?, ?, ?, ?)
    `,
    [itemId, fromId, q, at, projId, outRef, who],
  );

  const r2 = await query(
    `
    INSERT INTO inventory_movements
      (item_id, location_id, movement_type, qty, movement_at, projekat_id, ref_note, created_by)
    VALUES
      (?, ?, 'IN', ?, ?, ?, ?, ?)
    `,
    [itemId, toId, q, at, projId, inRef, who],
  );

  return {
    ok: true,
    movement_out_id: r1?.insertId ?? null,
    movement_in_id: r2?.insertId ?? null,
  };
}

export async function inventoryGetBalance(item_id, location_id) {
  const itemId = Number(item_id);
  const locId = Number(location_id);
  if (!Number.isInteger(itemId) || itemId <= 0)
    throw new Error("Neispravan item_id.");
  if (!Number.isInteger(locId) || locId <= 0)
    throw new Error("Neispravan location_id.");

  const bal = await getBalance(itemId, locId);
  return { ok: true, qty_balance: bal };
}

export async function inventoryListMovements({
  item_id = null,
  location_id = null,
  projekat_id = null,
  limit = 200,
} = {}) {
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);

  const filters = [];
  const vals = [];

  if (
    item_id !== null &&
    item_id !== undefined &&
    String(item_id).trim() !== ""
  ) {
    const n = Number(item_id);
    if (!Number.isInteger(n) || n <= 0) throw new Error("Neispravan item_id.");
    filters.push("m.item_id = ?");
    vals.push(n);
  }

  if (
    location_id !== null &&
    location_id !== undefined &&
    String(location_id).trim() !== ""
  ) {
    const n = Number(location_id);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error("Neispravan location_id.");
    filters.push("m.location_id = ?");
    vals.push(n);
  }

  if (
    projekat_id !== null &&
    projekat_id !== undefined &&
    String(projekat_id).trim() !== ""
  ) {
    const n = Number(projekat_id);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error("Neispravan projekat_id.");
    filters.push("m.projekat_id = ?");
    vals.push(n);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const r = await query(
    `
    SELECT
      m.movement_id, m.item_id, i.naziv AS item_naziv, i.kind, i.unit,
      m.location_id, l.naziv AS location_naziv,
      m.movement_type, m.qty, m.movement_at,
      m.projekat_id, m.ref_note, m.created_by, m.created_at
    FROM inventory_movements m
    JOIN inventory_items i ON i.item_id = m.item_id
    JOIN inventory_locations l ON l.location_id = m.location_id
    ${where}
    ORDER BY m.movement_at DESC, m.movement_id DESC
    LIMIT ${lim}
    `,
    vals,
  );

  return { ok: true, rows: r?.rows ?? [] };
}
