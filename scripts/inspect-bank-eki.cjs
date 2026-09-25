"use strict";
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function loadEnv() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
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
    process.env[key] = v;
  }
}

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  const [cols] = await conn.query("DESCRIBE bank_transakcije");
  console.log("COLS:", cols.map(c => c.Field));

  const [rows] = await conn.query(`
    SELECT id, booking_date, value_date, amount, currency, counterparty_name, counterparty_account, description
    FROM bank_transakcije
    WHERE counterparty_name LIKE '%EKI%' OR description LIKE '%EKI%' OR description LIKE '%kredit%'
    ORDER BY booking_date DESC
    LIMIT 30
  `);
  console.log("EKI ROWS:", rows);

  await conn.end();
}

main().catch(console.error);
