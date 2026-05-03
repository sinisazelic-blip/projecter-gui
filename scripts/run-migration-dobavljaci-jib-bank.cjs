/**
 * Migracija: dobavljaci.jib, bank_broj_racuna, bank_iban, bank_swift, bank_naziv, bank_adresa
 *   node scripts/run-migration-dobavljaci-jib-bank.cjs
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
  const sqlPath = path.join(root, "scripts", "migrations", "2026-05-03_dobavljaci_jib_bank.sql");
  if (!fs.existsSync(sqlPath)) throw new Error(`Nema fajla: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, "utf8");
  const conn = await mysql.createConnection(getConnectionOptions());
  try {
    console.log("Baza:", process.env.DB_NAME, "@", process.env.DB_HOST);
    await conn.query(sql);
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dobavljaci'
         AND COLUMN_NAME IN ('jib','bank_broj_racuna','bank_iban','bank_swift','bank_naziv','bank_adresa')`,
    );
    const c = rows?.[0]?.c ?? 0;
    console.log("OK. Novih kolona (očekivano 6):", c);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
