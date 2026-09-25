"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function loadEnv(root) {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      v = v.replace(/\s+#.*$/, "").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = v;
    }
    return;
  }
}

async function main() {
  const root = path.join(__dirname, "..");
  loadEnv(root);

  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port,
    ssl:
      port === 25060 || process.env.DB_SSL === "1" || process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    const [colRows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'krediti' AND COLUMN_NAME = 'broj_ugovora'"
    );

    if (!colRows[0].c) {
      await conn.query(`
        ALTER TABLE krediti 
        ADD COLUMN broj_ugovora VARCHAR(100) NULL COMMENT 'Partija/broj ugovora za automatsko knjiženje iz izvoda' AFTER naziv
      `);
      console.log("Dodana kolona krediti.broj_ugovora");
    } else {
      console.log("Kolona krediti.broj_ugovora već postoji.");
    }

    // Set contract for EKI 2026
    await conn.query(`
      UPDATE krediti
      SET broj_ugovora = 'LD2609610022',
          uplaceno_rata = 5,
          datum_posljednja_rata = '2026-09-18'
      WHERE kredit_id = 1 OR naziv LIKE '%EKI%'
    `);
    console.log("Ažuriran EKI 2026: broj_ugovora='LD2609610022', uplaceno_rata=5");

    console.log("Migracija kredita završena uspješno.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
