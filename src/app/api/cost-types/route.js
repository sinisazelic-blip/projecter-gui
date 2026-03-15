import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fallback kad tip_troska ne postoji ili je prazna (npr. demo baza)
const DEFAULT_COST_TYPES = [
  { id: 1, name: "Honorar", requires_entity: "TALENT" },
  { id: 2, name: "Ostalo", requires_entity: "NONE" },
  { id: 3, name: "Firma", requires_entity: "VENDOR" },
];

export async function GET() {
  try {
    const rows = await query(`
      SELECT
        tip_id AS id,
        naziv AS name,
        COALESCE(requires_entity, 'none') AS requires_entity
      FROM tip_troska
      ORDER BY naziv
    `);

    const items = Array.isArray(rows) && rows.length > 0 ? rows : DEFAULT_COST_TYPES;
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: true, items: DEFAULT_COST_TYPES });
  }
}
