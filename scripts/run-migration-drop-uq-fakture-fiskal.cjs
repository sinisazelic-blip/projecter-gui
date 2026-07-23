/**
 * Migracija: ukloni UNIQUE na fakture.broj_fiskalni
 * Novi storno sistem: storno dijeli PFR sa originalnom fakturom.
 *
 * Usage: node scripts/run-migration-drop-uq-fakture-fiskal.cjs
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
    ssl:
      process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await conn.query(`ALTER TABLE fakture DROP INDEX uq_fakture_fiskal`);
    console.log("OK: dropped uq_fakture_fiskal");
  } catch (e) {
    if (e && (e.code === "ER_CANT_DROP_FIELD_OR_KEY" || e.errno === 1091)) {
      console.log("OK: uq_fakture_fiskal već ne postoji");
    } else {
      throw e;
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
