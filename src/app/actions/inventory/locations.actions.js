// src/app/actions/inventory/locations.actions.js
"use server";

import { query } from "@/lib/db";
import { assertNonEmpty, assertOptionalStr, assertBool } from "./inventory.validate";

export async function inventoryCreateLocation({ naziv, opis }) {
  const name = assertNonEmpty("Naziv lokacije", naziv, 160);
  const desc = assertOptionalStr("Opis", opis, 255);

  // unique naziv
  const exists = await query(
    "SELECT location_id FROM inventory_locations WHERE naziv = ? LIMIT 1",
    [name]
  );
  if (exists?.rows?.length) throw new Error("Lokacija sa tim nazivom već postoji.");

  const r = await query(
    "INSERT INTO inventory_locations (naziv, opis, aktivan) VALUES (?, ?, 1)",
    [name, desc]
  );

  return { ok: true, location_id: r?.insertId ?? null };
}

export async function inventoryUpdateLocation(location_id, { naziv, opis }) {
  const id = Number(location_id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Neispravan location_id.");

  const name = naziv !== undefined ? assertNonEmpty("Naziv lokacije", naziv, 160) : undefined;
  const desc = opis !== undefined ? assertOptionalStr("Opis", opis, 255) : undefined;

  const cur = await query(
    "SELECT location_id, naziv FROM inventory_locations WHERE location_id = ? LIMIT 1",
    [id]
  );
  if (!cur?.rows?.length) throw new Error("Lokacija ne postoji.");

  if (name !== undefined) {
    const dup = await query(
      "SELECT location_id FROM inventory_locations WHERE naziv = ? AND location_id <> ? LIMIT 1",
      [name, id]
    );
    if (dup?.rows?.length) throw new Error("Druga lokacija već ima taj naziv.");
  }

  const sets = [];
  const vals = [];

  if (name !== undefined) {
    sets.push("naziv = ?");
    vals.push(name);
  }
  if (desc !== undefined) {
    sets.push("opis = ?");
    vals.push(desc);
  }

  if (!sets.length) return { ok: true, updated: 0 };

  vals.push(id);

  await query(
    `UPDATE inventory_locations SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE location_id = ?`,
    vals
  );

  return { ok: true, updated: 1 };
}

export async function inventorySetLocationActive(location_id, aktivan) {
  const id = Number(location_id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Neispravan location_id.");

  const active = assertBool("Aktivan", aktivan);

  const cur = await query(
    "SELECT location_id FROM inventory_locations WHERE location_id = ? LIMIT 1",
    [id]
  );
  if (!cur?.rows?.length) throw new Error("Lokacija ne postoji.");

  await query(
    "UPDATE inventory_locations SET aktivan = ?, updated_at = CURRENT_TIMESTAMP WHERE location_id = ?",
    [active, id]
  );

  return { ok: true, aktivan: !!active };
}

export async function inventoryListLocations({ includeInactive = false } = {}) {
  const inc = includeInactive ? 1 : 0;
  const r = await query(
    `
    SELECT location_id, naziv, opis, aktivan, created_at, updated_at
    FROM inventory_locations
    WHERE (? = 1) OR aktivan = 1
    ORDER BY aktivan DESC, naziv ASC
    `,
    [inc]
  );
  return { ok: true, rows: r?.rows ?? [] };
}
