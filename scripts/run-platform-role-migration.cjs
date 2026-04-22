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

    const [roleColRows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'soccs_platform_role'",
    );
    if (!roleColRows[0].c) {
      await conn.query(
        "ALTER TABLE tenants ADD COLUMN soccs_platform_role VARCHAR(24) NULL COMMENT 'Globalna uloga za SOCCS access: OWNER|AMBASSADOR' AFTER soccs_tier",
      );
      console.log("Dodana kolona soccs_platform_role");
    } else {
      console.log("Kolona soccs_platform_role već postoji");
    }

    const [scopeColRows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'soccs_platform_scope'",
    );
    if (!scopeColRows[0].c) {
      await conn.query(
        "ALTER TABLE tenants ADD COLUMN soccs_platform_scope TEXT NULL COMMENT 'Scope za platformsku ulogu: * ili CSV tenant_public_id vrijednosti' AFTER soccs_platform_role",
      );
      console.log("Dodana kolona soccs_platform_scope");
    } else {
      console.log("Kolona soccs_platform_scope već postoji");
    }

    await conn.query(
      "UPDATE tenants SET soccs_platform_role = NULL WHERE soccs_platform_role IS NOT NULL AND UPPER(TRIM(soccs_platform_role)) NOT IN ('OWNER', 'AMBASSADOR')",
    );
    console.log("Validacija postojećih role vrijednosti završena");
    console.log("Migracija završena (OK).");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
