import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBool(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (["1", "da", "yes", "true", "y"].includes(s)) return 1;
  if (["0", "ne", "no", "false", "n"].includes(s)) return 0;
  return null;
}

function splitLines(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export async function POST(req) {
  let conn;
  try {
    const url = new URL(req.url);
    const batchId = Number(url.searchParams.get("batch_id") ?? 1);

    const form = await req.formData();
    const file = form.get("file");
    if (!file) {
      return NextResponse.json(
        { ok: false, message: "Nedostaje file (multipart field: file)" },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const text = buf.toString("utf8");

    const lines = splitLines(text).filter((l) => l.trim() !== "");
    if (lines.length < 2) {
      return NextResponse.json(
        { ok: false, message: "CSV je prazan (nema data redova)" },
        { status: 400 },
      );
    }

    const header = lines[0].split(";").map((h) => h.trim());
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));

    // očekujemo: ime_prezime;vrsta;email;telefon;napomena;aktivan
    const required = ["ime_prezime"];
    for (const r of required) {
      if (!(r in idx))
        return NextResponse.json(
          { ok: false, message: `Nedostaje kolona: ${r}` },
          { status: 400 },
        );
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(";"); // jednostavno, jer je vaš CSV sa ';'
      const ime_prezime = (parts[idx["ime_prezime"]] ?? "").trim();
      if (!ime_prezime) continue;

      const vrsta = (parts[idx["vrsta"]] ?? "").trim() || null;
      const email = (parts[idx["email"]] ?? "").trim() || null;
      const telefon = (parts[idx["telefon"]] ?? "").trim() || null;
      const napomena = (parts[idx["napomena"]] ?? "").trim() || null;
      const aktivan = parseBool(parts[idx["aktivan"]]);

      rows.push([
        batchId,
        ime_prezime,
        vrsta,
        email,
        telefon,
        napomena,
        aktivan,
      ]);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Nema validnih redova za import" },
        { status: 400 },
      );
    }

    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT ?? 3306),
    });

    // staging tabela za talent import (sigurna i jednostavna)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stg_talenti (
        stg_id BIGINT NOT NULL AUTO_INCREMENT,
        batch_id INT NOT NULL,
        ime_prezime VARCHAR(255) NOT NULL,
        vrsta VARCHAR(100) NULL,
        email VARCHAR(255) NULL,
        telefon VARCHAR(100) NULL,
        napomena VARCHAR(500) NULL,
        aktivan TINYINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (stg_id),
        KEY idx_stg_talenti_batch (batch_id),
        KEY idx_stg_talenti_ime (ime_prezime)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ubacujemo u chunkovima
    const chunkSize = 1000;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const [res] = await conn.query(
        `INSERT INTO stg_talenti (batch_id, ime_prezime, vrsta, email, telefon, napomena, aktivan) VALUES ?`,
        [chunk],
      );
      inserted += res.affectedRows ?? chunk.length;
    }

    return NextResponse.json({
      ok: true,
      batch_id: batchId,
      scanned_lines: lines.length - 1,
      inserted_rows: inserted,
      header,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? String(e) },
      { status: 500 },
    );
  } finally {
    if (conn) await conn.end();
  }
}
