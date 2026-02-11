import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function POST(req) {
  let conn;
  try {
    const body = await req.json();

    const {
      projekat_id,
      fakturisano,
      datum_fakture,
      datum_valute,
      iznos,
      valuta,
      napomena,
    } = body;

    if (!projekat_id) {
      return NextResponse.json(
        { ok: false, error: "Nedostaje projekat_id" },
        { status: 400 },
      );
    }

    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || "25060"),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false },
    });

    // 1 potraživanje po projektu (za sada) → UPSERT logika
    const sql = `
      INSERT INTO projekt_potrazivanja
      (projekat_id, fakturisano, datum_fakture, datum_valute, iznos, valuta, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        fakturisano = VALUES(fakturisano),
        datum_fakture = VALUES(datum_fakture),
        datum_valute = VALUES(datum_valute),
        iznos = VALUES(iznos),
        valuta = VALUES(valuta),
        napomena = VALUES(napomena),
        updated_at = CURRENT_TIMESTAMP
    `;

    await conn.query(sql, [
      projekat_id,
      fakturisano ? 1 : 0,
      datum_fakture || null,
      datum_valute || null,
      iznos || null,
      valuta || "BAM",
      napomena || null,
    ]);

    return NextResponse.json({ ok: true, success: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  } finally {
    if (conn) await conn.end();
  }
}
