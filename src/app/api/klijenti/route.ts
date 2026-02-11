import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    const [rows]: any = await (pool as any).query(
      `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [table, column],
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    // ✅ sigurno: ne puca ako is_ino ne postoji
    const hasIsINO = await hasColumn("klijenti", "is_ino");

    const sql = hasIsINO
      ? `
        SELECT
          klijent_id,
          naziv_klijenta,
          COALESCE(is_ino, 0) AS is_ino
        FROM klijenti
        ORDER BY naziv_klijenta ASC
      `
      : `
        SELECT
          klijent_id,
          naziv_klijenta,
          0 AS is_ino
        FROM klijenti
        ORDER BY naziv_klijenta ASC
      `;

    const [rows] = await (pool as any).query(sql);

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greska" },
      { status: 500 },
    );
  }
}
