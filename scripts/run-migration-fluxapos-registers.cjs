"use strict";

/**
 * Idempotentno kreira tabelu fluxapos_active_registers za evidenciju aktivnih POS kasa po tenantu.
 * Pokretanje: node scripts/run-migration-fluxapos-registers.cjs
 */

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

function mustEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Nedostaje env: ${name}`);
  return value;
}

async function main() {
  const root = path.join(__dirname, "..");
  loadEnv(root);

  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const conn = await mysql.createConnection({
    host: mustEnv("DB_HOST"),
    user: mustEnv("DB_USER"),
    password: mustEnv("DB_PASSWORD"),
    database: mustEnv("DB_NAME"),
    port,
    ssl:
      port === 25060 ||
      process.env.DB_SSL === "1" ||
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    console.log("Baza:", process.env.DB_NAME, "@", process.env.DB_HOST);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS fluxapos_active_registers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        kasa_broj VARCHAR(64) NOT NULL,
        kasa_naziv VARCHAR(128) NULL,
        device_ip VARCHAR(64) NULL,
        app_version VARCHAR(32) NULL,
        last_seen DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tenant_kasa (tenant_id, kasa_broj),
        INDEX idx_tenant_last_seen (tenant_id, last_seen)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Tabela fluxapos_active_registers: OK.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
