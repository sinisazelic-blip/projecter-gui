"use strict";

/**
 * Idempotentno dodaje kolone za kontakt i licence alert dedup na `tenants`.
 * npm run migrate:licence-alert-contacts
 */

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const COLS = [
  {
    name: "billing_email",
    sql: `ADD COLUMN billing_email VARCHAR(255) NULL
      COMMENT 'Email za licence / upozorenja (Studio ručno ili User zone)'
      AFTER studio_licence_profile`,
  },
  {
    name: "billing_phone",
    sql: `ADD COLUMN billing_phone VARCHAR(64) NULL
      COMMENT 'Telefon za SMS (opciono, kad se uvede provajder)'
      AFTER billing_email`,
  },
  {
    name: "last_licence_alert_at",
    sql: `ADD COLUMN last_licence_alert_at DATETIME NULL
      COMMENT 'Zadnji put kad je poslato bilo koje licence upozorenje'
      AFTER billing_phone`,
  },
  {
    name: "last_licence_alert_key",
    sql: `ADD COLUMN last_licence_alert_key VARCHAR(191) NULL
      COMMENT 'Potpis stanja (dedup iste poruke dok se stanje ne promijeni)'
      AFTER last_licence_alert_at`,
  },
];

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

    for (const col of COLS) {
      const [rows] = await conn.query(
        "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = ?",
        [col.name],
      );
      if (rows[0].c) {
        console.log(`Kolona tenants.${col.name} već postoji`);
        continue;
      }
      await conn.query(`ALTER TABLE tenants ${col.sql}`);
      console.log(`Dodata kolona tenants.${col.name}`);
    }

    console.log("Migracija završena (OK).");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
