/**
 * Pokreće migraciju kuf_ulazne_fakture.pdv_iznos_km (bez Workbench-a).
 *
 *   node scripts/run-migration-kuf-pdv.cjs
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function loadEnvLocal(root) {
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
      if (!(v.startsWith('"') || v.startsWith("'"))) {
        v = v.replace(/\s+#.*$/, "").trim();
      }
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = v;
    }
    return;
  }
}

function getConnectionOptions() {
  const must = (n) => {
    const v = process.env[n];
    if (!v) throw new Error(`Nedostaje env: ${n} (postavi u .env.local)`);
    return v;
  };
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const opts = {
    host: must("DB_HOST"),
    user: must("DB_USER"),
    password: must("DB_PASSWORD"),
    database: must("DB_NAME"),
    port,
    multipleStatements: true,
  };
  if (port === 25060 || process.env.DB_SSL === "1" || process.env.DB_SSL === "true") {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

async function main() {
  const root = path.join(__dirname, "..");
  loadEnvLocal(root);

  const sqlPath = path.join(root, "scripts", "migrations", "2026-04-30_kuf_pdv_iznos_km.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Nema fajla: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const conn = await mysql.createConnection(getConnectionOptions());
  try {
    console.log("Baza:", process.env.DB_NAME, "@", process.env.DB_HOST);
    console.log("SQL:", sqlPath);
    await conn.query(sql);
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kuf_ulazne_fakture' AND COLUMN_NAME = 'pdv_iznos_km'
       LIMIT 1`,
    );
    console.log("OK. Kolona pdv_iznos_km:", Array.isArray(rows) && rows.length > 0 ? "postoji" : "nije pronađena");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
