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
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_privatne_pretplate' AND COLUMN_NAME = 'mjesec_u_godini'"
    );

    if (!colRows[0].c) {
      await conn.query(`
        ALTER TABLE owner_privatne_pretplate 
        ADD COLUMN mjesec_u_godini INT NULL COMMENT '1-12 mjesec za godišnje pretplate' AFTER dan_u_mjesecu
      `);
      console.log("Dodana kolona owner_privatne_pretplate.mjesec_u_godini");
    } else {
      console.log("Kolona owner_privatne_pretplate.mjesec_u_godini već postoji.");
    }

    // Set defaults for known annual subscriptions if month is null
    // e.g. Elgato (may = 5), Viber Plus (september = 9 or month from created_at)
    await conn.query(`
      UPDATE owner_privatne_pretplate
      SET mjesec_u_godini = 5
      WHERE naziv LIKE '%Elgato%' AND (mjesec_u_godini IS NULL OR mjesec_u_godini = 0)
    `);

    await conn.query(`
      UPDATE owner_privatne_pretplate
      SET mjesec_u_godini = 9
      WHERE naziv LIKE '%Viber%' AND (mjesec_u_godini IS NULL OR mjesec_u_godini = 0)
    `);

    console.log("Migracija pretplata završena uspješno.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
