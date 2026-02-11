import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function splitLines(text) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
}

function toNumberKM(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const norm = s.replace(",", ".").replace(/\s+/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req) {
  let conn;
  try {
    const url = new URL(req.url);
    const batchId = Number(url.searchParams.get("batch_id") ?? 1);

    const payload = await req.json();
    const source_file = payload?.source_file ?? null;

    if (!payload?.csv_b64) {
      return NextResponse.json(
        { ok: false, message: "Nedostaje csv_b64" },
        { status: 400 },
      );
    }

    const csvText = Buffer.from(String(payload.csv_b64), "base64").toString(
      "utf8",
    );
    const lines = splitLines(csvText);

    if (lines.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          message: "CSV je prazan (nema data redova)",
          debug: {
            len: csvText.length,
            head200: csvText.slice(0, 200),
            tail200: csvText.slice(Math.max(0, csvText.length - 200)),
            lineCountGuessN: (csvText.match(/\n/g) || []).length,
            lineCountGuessR: (csvText.match(/\r/g) || []).length,
          },
        },
        { status: 400 },
      );
    }

    // header: projekat_id;talent_id;datum;opis;iznos;porez_i_troskovi;napomena
    const header = lines[0].split(";").map((h) => h.trim());
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));

    for (const col of ["projekat_id", "talent_id", "datum", "iznos"]) {
      if (!(col in idx)) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Nedostaje kolona: " +
              col +
              " (header: " +
              header.join(";") +
              ")",
          },
          { status: 400 },
        );
      }
    }

    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT ?? 3306),
    });

    // osiguraj staging tabelu stavki troškova
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stg_troskovi_po (
        stg_id BIGINT NOT NULL AUTO_INCREMENT,
        batch_id INT NOT NULL,
        id_po INT NULL,
        vrsta ENUM('TALENT','DOBAVLJAC') NULL,
        naziv VARCHAR(255) NULL,
        status_raw VARCHAR(50) NULL,
        datum DATE NULL,
        iznos_km DECIMAL(12,2) NULL,
        opis VARCHAR(500) NULL,
        ref VARCHAR(100) NULL,
        source_file VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (stg_id),
        KEY idx_stg_batch (batch_id),
        KEY idx_stg_id_po (id_po),
        KEY idx_stg_vrsta (vrsta)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // napravi mapu talent_id -> ime_prezime iz stg_talenti (batch 1) ili fallback na talent_id
    const [talRows] = await conn.query(
      `SELECT stg_id, ime_prezime
       FROM stg_talenti
       WHERE batch_id = ?
       ORDER BY stg_id`,
      [batchId],
    );

    // pošto u talenti.csv nema talent_id kolone, ne možemo direktno mapirati.
    // Zato naziv = "talent_id:<id>" dok ne uvedemo pravu mapu.
    // (Ako imaš tabelu talenti sa ID-evima, kasnije ćemo join.)
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(";");
      const id_po = Number((parts[idx["projekat_id"]] ?? "").trim() || "");
      const talent_id = (parts[idx["talent_id"]] ?? "").trim();
      const datum = (parts[idx["datum"]] ?? "").trim();
      const opis = (parts[idx["opis"]] ?? "").trim();
      const iznos = toNumberKM(parts[idx["iznos"]]);
      const porez = toNumberKM(parts[idx["porez_i_troskovi"]]);
      const napomena = (parts[idx["napomena"]] ?? "").trim();

      if (!Number.isFinite(id_po) || !talent_id) continue;

      const total = (iznos ?? 0) + (porez ?? 0);

      rows.push([
        batchId,
        id_po,
        "TALENT",
        "talent_id:" + talent_id,
        "dogovoreno",
        datum || null,
        total || null,
        (opis || "") + (napomena ? " | " + napomena : ""),
        null,
        source_file,
      ]);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Nema validnih redova za import" },
        { status: 400 },
      );
    }

    const chunkSize = 1000;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const [res] = await conn.query(
        `INSERT INTO stg_troskovi_po
         (batch_id, id_po, vrsta, naziv, status_raw, datum, iznos_km, opis, ref, source_file)
         VALUES ?`,
        [chunk],
      );
      inserted += res?.affectedRows ?? chunk.length;
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
