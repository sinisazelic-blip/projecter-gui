/**
 * Umeće stavke Članarina i Ostalo u fiksni_troskovi (idempotentno).
 *   node scripts/run-migration-fiksni-clanarina-ostalo.cjs
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
  const sqlPath = path.join(
    root,
    "scripts",
    "migrations",
    "2026-05-04_fiksni_troskovi_clanarina_ostalo.sql",
  );
  if (!fs.existsSync(sqlPath)) throw new Error(`Nema fajla: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, "utf8");
  const conn = await mysql.createConnection(getConnectionOptions());
  try {
    console.log("Baza:", process.env.DB_NAME, "@", process.env.DB_HOST);
    await conn.query(sql);
    const [rows] = await conn.query(
      `SELECT trosak_id, naziv_troska FROM fiksni_troskovi
       WHERE LOWER(TRIM(naziv_troska)) IN ('članarina','ostalo')
       ORDER BY naziv_troska`,
    );
    console.log("OK. Redovi članarina/ostalo:", Array.isArray(rows) ? rows.length : 0);
    if (Array.isArray(rows)) rows.forEach((r) => console.log("  -", r.trosak_id, r.naziv_troska));
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
