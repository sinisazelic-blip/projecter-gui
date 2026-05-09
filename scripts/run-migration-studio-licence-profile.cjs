"use strict";

/**
 * Idempotentna migracija (bez Workbench-a):
 * 1) Stub plan u `plans` za tenante bez Fluxa paketa (samo SOCCS/SwimVoice).
 * 2) Kolona `tenants.studio_licence_profile` (FLUXA_ONLY | SOCCS_SWIMVOICE | FLUXA_AND_SOCCS).
 *
 * Pokretanje iz korijena repoa (koristi .env.local ili .env):
 *   node scripts/run-migration-studio-licence-profile.cjs
 * ili:
 *   npm run migrate:studio-licence-profile
 */

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const STUB_PLAN_NAZIV = "— (bez Fluxa paketa)";

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

    await conn.query(
      "INSERT IGNORE INTO plans (naziv, max_users, max_saradnici) VALUES (?, 1, 0)",
      [STUB_PLAN_NAZIV],
    );
    console.log("Stub plan u `plans`: OK (INSERT IGNORE).");

    const [colRows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'studio_licence_profile'",
    );
    if (!colRows[0].c) {
      const [refRows] = await conn.query(
        "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'tenant_public_id'",
      );
      const afterPublicId = refRows[0].c > 0;
      const alterSql = afterPublicId
        ? `ALTER TABLE tenants ADD COLUMN studio_licence_profile VARCHAR(32) NULL
            COMMENT 'FLUXA_ONLY | SOCCS_SWIMVOICE | FLUXA_AND_SOCCS'
            AFTER tenant_public_id`
        : `ALTER TABLE tenants ADD COLUMN studio_licence_profile VARCHAR(32) NULL
            COMMENT 'FLUXA_ONLY | SOCCS_SWIMVOICE | FLUXA_AND_SOCCS'`;
      await conn.query(alterSql);
      console.log("Dodana kolona tenants.studio_licence_profile");
    } else {
      console.log("Kolona tenants.studio_licence_profile već postoji");
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
