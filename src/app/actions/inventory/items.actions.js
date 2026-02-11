// src/app/actions/inventory/items.actions.js
"use server";

import { query } from "@/lib/db";
import {
  assertNonEmpty,
  assertOptionalStr,
  assertEnum,
  assertBool,
  toTrimmed,
} from "./inventory.validate";

const ALLOWED_KINDS = ["CONSUMABLE", "ASSET", "LICENSE"];

export async function inventoryCreateItem({
  naziv,
  kind = "CONSUMABLE",
  unit = "kom",
  sku = null,
  min_qty = null,
  napomena = null,
}) {
  const name = assertNonEmpty("Naziv artikla", naziv, 200);
  const k = assertEnum("Vrsta (kind)", kind, ALLOWED_KINDS);
  const u = assertNonEmpty("Jedinica (unit)", unit, 32);
  const sSku = assertOptionalStr("SKU", sku, 80);
  const note = assertOptionalStr("Napomena", napomena, 255);

  let min = null;
  if (min_qty !== null && min_qty !== undefined && toTrimmed(min_qty) !== "") {
    const n = Number(min_qty);
    if (!Number.isFinite(n) || n < 0)
      throw new Error("min_qty mora biti broj >= 0.");
    min = Math.round(n * 1000) / 1000;
  }

  if (sSku) {
    const dup = await query(
      "SELECT item_id FROM inventory_items WHERE sku = ? LIMIT 1",
      [sSku],
    );
    if (dup?.rows?.length) throw new Error("SKU već postoji.");
  }

  const r = await query(
    `
    INSERT INTO inventory_items
      (naziv, kind, unit, sku, min_qty, aktivan, napomena)
    VALUES
      (?, ?, ?, ?, ?, 1, ?)
    `,
    [name, k, u, sSku, min, note],
  );

  return { ok: true, item_id: r?.insertId ?? null };
}

export async function inventoryUpdateItem(item_id, fields) {
  const id = Number(item_id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Neispravan item_id.");

  const cur = await query(
    "SELECT item_id FROM inventory_items WHERE item_id = ? LIMIT 1",
    [id],
  );
  if (!cur?.rows?.length) throw new Error("Artikal ne postoji.");

  const sets = [];
  const vals = [];

  if (fields?.naziv !== undefined) {
    sets.push("naziv = ?");
    vals.push(assertNonEmpty("Naziv artikla", fields.naziv, 200));
  }

  if (fields?.kind !== undefined) {
    sets.push("kind = ?");
    vals.push(assertEnum("Vrsta (kind)", fields.kind, ALLOWED_KINDS));
  }

  if (fields?.unit !== undefined) {
    sets.push("unit = ?");
    vals.push(assertNonEmpty("Jedinica (unit)", fields.unit, 32));
  }

  if (fields?.sku !== undefined) {
    const sSku = assertOptionalStr("SKU", fields.sku, 80);
    if (sSku) {
      const dup = await query(
        "SELECT item_id FROM inventory_items WHERE sku = ? AND item_id <> ? LIMIT 1",
        [sSku, id],
      );
      if (dup?.rows?.length)
        throw new Error("SKU već postoji na drugom artiklu.");
    }
    sets.push("sku = ?");
    vals.push(sSku);
  }

  if (fields?.min_qty !== undefined) {
    let min = null;
    const raw = fields.min_qty;
    if (raw !== null && raw !== undefined && toTrimmed(raw) !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0)
        throw new Error("min_qty mora biti broj >= 0.");
      min = Math.round(n * 1000) / 1000;
    }
    sets.push("min_qty = ?");
    vals.push(min);
  }

  if (fields?.napomena !== undefined) {
    sets.push("napomena = ?");
    vals.push(assertOptionalStr("Napomena", fields.napomena, 255));
  }

  if (fields?.aktivan !== undefined) {
    sets.push("aktivan = ?");
    vals.push(assertBool("Aktivan", fields.aktivan));
  }

  if (!sets.length) return { ok: true, updated: 0 };

  vals.push(id);

  await query(
    `UPDATE inventory_items SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?`,
    vals,
  );

  return { ok: true, updated: 1 };
}

export async function inventorySetItemActive(item_id, aktivan) {
  const id = Number(item_id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Neispravan item_id.");
  const active = assertBool("Aktivan", aktivan);

  const cur = await query(
    "SELECT item_id FROM inventory_items WHERE item_id = ? LIMIT 1",
    [id],
  );
  if (!cur?.rows?.length) throw new Error("Artikal ne postoji.");

  await query(
    "UPDATE inventory_items SET aktivan = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?",
    [active, id],
  );

  return { ok: true, aktivan: !!active };
}

export async function inventoryListItems({
  includeInactive = false,
  q = "",
} = {}) {
  const inc = includeInactive ? 1 : 0;
  const term = toTrimmed(q);
  const like = term ? `%${term}%` : null;

  const r = await query(
    `
    SELECT item_id, naziv, kind, unit, sku, min_qty, aktivan, napomena, created_at, updated_at
    FROM inventory_items
    WHERE
      ((? = 1) OR aktivan = 1)
      AND
      (
        ? IS NULL
        OR naziv LIKE ?
        OR sku LIKE ?
      )
    ORDER BY aktivan DESC, naziv ASC
    `,
    [inc, like, like, like],
  );

  return { ok: true, rows: r?.rows ?? [] };
}
