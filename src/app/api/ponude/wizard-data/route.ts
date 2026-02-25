// GET: podaci za wizard ponude – deal (klijent, valuta) + stavke (sa inicijacija_stavka_id za grupisanje)
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function asInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const x = Math.trunc(n);
  return x <= 0 ? null : x;
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    const [rows]: any = await (pool as any).query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [table, column],
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inicijacija_id = asInt(searchParams.get("inicijacija_id"));
    if (!inicijacija_id) {
      return NextResponse.json(
        { ok: false, error: "Nedostaje inicijacija_id." },
        { status: 400 },
      );
    }

    const conn = await pool.getConnection();
    try {
      const [dealRows]: any = await conn.query(
        `
        SELECT i.inicijacija_id, i.narucilac_id, i.krajnji_klijent_id,
               k.naziv_klijenta, k.drzava, COALESCE(k.is_ino, 0) AS is_ino
        FROM inicijacije i
        LEFT JOIN klijenti k ON k.klijent_id = i.narucilac_id
        WHERE i.inicijacija_id = ?
        LIMIT 1
        `,
        [inicijacija_id],
      );
      const deal = Array.isArray(dealRows) && dealRows.length ? dealRows[0] : null;
      if (!deal) {
        return NextResponse.json(
          { ok: false, error: "Deal nije pronađen." },
          { status: 404 },
        );
      }

      const hasStorno = await hasColumn("inicijacija_stavke", "stornirano");
      const [stavkeRows]: any = await conn.query(
        `
        SELECT inicijacija_stavka_id, naziv_snapshot, COALESCE(jedinica_snapshot, 'kom') AS jedinica_snapshot,
               kolicina, cijena_jedinicna, valuta, opis, line_total
        FROM inicijacija_stavke
        WHERE inicijacija_id = ?
          ${hasStorno ? "AND stornirano = 0" : ""}
        ORDER BY inicijacija_stavka_id ASC
        `,
        [inicijacija_id],
      );
      const stavke = Array.isArray(stavkeRows) ? stavkeRows : [];

      const isIno = Number(deal.is_ino ?? 0) === 1;
      const valuta = isIno ? "EUR" : "KM";

      return NextResponse.json({
        ok: true,
        deal: {
          inicijacija_id: deal.inicijacija_id,
          klijent_id: deal.narucilac_id ?? deal.krajnji_klijent_id,
          naziv_klijenta: deal.naziv_klijenta,
          is_ino: isIno,
          valuta,
        },
        stavke,
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška (wizard-data)" },
      { status: 500 },
    );
  }
}
