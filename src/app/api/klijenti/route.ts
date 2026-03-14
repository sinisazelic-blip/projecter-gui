import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { withDbSession } from "@/lib/auth/with-db-session";

/** POST: brzo kreiranje klijenta (samo naziv) – za Novi deal flow. Vraća klijent_id. */
export async function POST(req: NextRequest) {
  return withDbSession(req, async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const naziv = String(body?.naziv_klijenta ?? "").trim();
      if (!naziv) {
        return NextResponse.json(
          { ok: false, error: "naziv_klijenta je obavezan" },
          { status: 400 },
        );
      }
      const tip = String(body?.tip_klijenta ?? "direktni").toLowerCase() === "agencija" ? "agencija" : "direktni";
      const hasIsINO = await hasColumn("klijenti", "is_ino");
      const is_ino = body?.is_ino ? 1 : 0;
      const cols = hasIsINO
        ? "naziv_klijenta, tip_klijenta, porezni_id, adresa, grad, drzava, email, rok_placanja_dana, napomena, aktivan, is_ino, pdv_oslobodjen, pdv_oslobodjen_napomena, created_at, updated_at"
        : "naziv_klijenta, tip_klijenta, porezni_id, adresa, grad, drzava, email, rok_placanja_dana, napomena, aktivan, pdv_oslobodjen, pdv_oslobodjen_napomena, created_at, updated_at";
      const vals = hasIsINO ? "?, ?, NULL, NULL, NULL, NULL, NULL, 0, NULL, 1, ?, 0, NULL, NOW(), NOW()" : "?, ?, NULL, NULL, NULL, NULL, NULL, 0, NULL, 1, 0, NULL, NOW(), NOW()";
      const params = hasIsINO ? [naziv, tip, is_ino] : [naziv, tip];
      const [res] = await (pool as any).query(
        `INSERT INTO klijenti (${cols}) VALUES (${vals})`,
        params,
      );
      const klijent_id = res?.insertId ?? 0;
      if (!klijent_id) return NextResponse.json({ ok: false, error: "Insert nije vratio id" }, { status: 500 });
      return NextResponse.json({ ok: true, klijent_id, naziv_klijenta: naziv });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
    }
  });
}

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
