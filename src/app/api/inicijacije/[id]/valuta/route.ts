import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    const [rows]: any = await (pool as any).query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       LIMIT 1`,
      [table, column]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, error: "Neispravan ID" },
      { status: 400 },
    );
  }

  const hasIsINO = await hasColumn("klijenti", "is_ino");
  const sql = hasIsINO
    ? `SELECT COALESCE(k.is_ino, 0) AS is_ino
       FROM inicijacije i
       JOIN klijenti k ON k.klijent_id = i.narucilac_id
       WHERE i.inicijacija_id = ? LIMIT 1`
    : `SELECT 0 AS is_ino FROM inicijacije WHERE inicijacija_id = ? LIMIT 1`;

  const [rows]: any = await pool.query(sql, [id]);

  const is_ino = Array.isArray(rows) && rows.length ? Number(rows[0]?.is_ino ?? 0) === 1 : false;
  const valuta = is_ino ? "EUR" : "BAM";

  return NextResponse.json({ ok: true, valuta, is_ino });
}
