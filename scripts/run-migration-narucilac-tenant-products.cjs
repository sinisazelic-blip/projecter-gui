/**
 * Pokreće migracije (bez Workbench-a):
 *   1. klijenti.is_narucilac (+ inicijalno punjenje iz istorije)
 *   2. soccs_activation_codes.app + tenants.klijent_id (master / studio_db)
 *
 *   node scripts/run-migration-narucilac-tenant-products.cjs
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

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function runSqlFile(conn, root, file) {
  const sqlPath = path.join(root, "scripts", "migrations", file);
  if (!fs.existsSync(sqlPath)) throw new Error(`Nema fajla: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log("SQL:", file);
  await conn.query(sql);
}

async function main() {
  const root = path.join(__dirname, "..");
  loadEnvLocal(root);

  const conn = await mysql.createConnection(getConnectionOptions());
  try {
    console.log("Baza:", process.env.DB_NAME, "@", process.env.DB_HOST);

    if (await columnExists(conn, "klijenti", "is_narucilac")) {
      console.log("Preskačem: klijenti.is_narucilac već postoji.");
    } else {
      await runSqlFile(conn, root, "2026-06-11_klijenti_is_narucilac.sql");
      console.log("OK: klijenti.is_narucilac dodano i popunjeno iz istorije.");
    }

    if (await columnExists(conn, "soccs_activation_codes", "app")) {
      console.log("Preskačem: soccs_activation_codes.app već postoji.");
    } else {
      await conn.query(
        `ALTER TABLE soccs_activation_codes
           ADD COLUMN app VARCHAR(20) NOT NULL DEFAULT 'SOCCS'
             COMMENT 'SOCCS|POOL_MANAGER|DOCENTRE — kojoj aplikaciji kod pripada' AFTER purpose,
           ADD INDEX idx_sac_app (app)`,
      );
      console.log("OK: soccs_activation_codes.app dodano.");
    }

    if (await columnExists(conn, "tenants", "klijent_id")) {
      console.log("Preskačem: tenants.klijent_id već postoji.");
    } else {
      await conn.query(
        `ALTER TABLE tenants
           ADD COLUMN klijent_id INT NULL
             COMMENT 'FK na klijenti — naplata tenant licence kroz Fluxa fakturisanje' AFTER naziv,
           ADD INDEX idx_tenants_klijent (klijent_id)`,
      );
      console.log("OK: tenants.klijent_id dodano.");
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
