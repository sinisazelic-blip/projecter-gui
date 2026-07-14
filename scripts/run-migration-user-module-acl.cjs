/**
 * Migracija: user_module_acl
 * Usage: node scripts/run-migration-user-module-acl.cjs
 */
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      // strip inline comment outside quotes
      if (!v.startsWith('"') && !v.startsWith("'")) {
        const hash = v.indexOf(" #");
        if (hash >= 0) v = v.slice(0, hash).trim();
      }
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[m[1]] == null) process.env[m[1]] = v.trim();
    }
  }
}

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_module_acl (
      user_id INT NOT NULL,
      module_key VARCHAR(64) NOT NULL,
      access ENUM('none','view','edit') NOT NULL DEFAULT 'none',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, module_key),
      KEY idx_user_module_acl_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Kolona za SOCCS godišnju potrošnju (YTD) — owner vidi u Licence
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'
         AND COLUMN_NAME = 'soccs_meets_used_ytd'`,
    );
    if (!Array.isArray(cols) || cols.length === 0) {
      await conn.query(`
        ALTER TABLE tenants
          ADD COLUMN soccs_meets_used_ytd INT NOT NULL DEFAULT 0
            COMMENT 'Broj odobrenih takmičenja u tekućoj kalendarskoj godini (iz SOCCS telemetrije/CONSUME)',
          ADD COLUMN soccs_meets_ytd_year SMALLINT NULL
            COMMENT 'Godina na koju se odnosi soccs_meets_used_ytd'
      `);
      console.log("Added tenants.soccs_meets_used_ytd + soccs_meets_ytd_year");
    } else {
      console.log("tenants.soccs_meets_used_ytd already exists");
    }
  } catch (e) {
    console.warn("Optional tenants YTD columns:", e?.message || e);
  }

  console.log("OK: user_module_acl ready");
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
