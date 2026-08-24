"use strict";
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function loadEnvLocal(root) {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (!(v.startsWith('"') || v.startsWith("'"))) v = v.replace(/\s+#.*$/, "").trim();
      if (process.env[key] === undefined) process.env[key] = v;
    }
    return;
  }
}

async function main() {
  loadEnvLocal(path.join(__dirname, ".."));
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port,
    ssl: port === 25060 ? { rejectUnauthorized: false } : undefined,
  });

  const [inv] = await c.query(
    `SELECT faktura_id, broj_fakture_puni, iznos_ukupno_km, fiskalni_status
     FROM fakture WHERE broj_u_godini BETWEEN 25 AND 32 AND godina = 2026`,
  );
  console.log("=== UNPAID TARGET INVOICES ===");
  console.table(inv);

  for (const row of inv) {
    const amt = Number(row.iznos_ukupno_km);
    const [p] = await c.query(
      `SELECT p.posting_id, p.amount, p.description, p.value_date,
              (SELECT COUNT(*) FROM bank_tx_posting_prihod_link l WHERE l.posting_id=p.posting_id AND l.aktivan=1) AS links
       FROM bank_tx_posting p
       WHERE p.amount > 0 AND ABS(p.amount - ?) < 0.01
       ORDER BY p.posting_id DESC LIMIT 5`,
      [amt],
    );
    if (p.length) {
      console.log(`\nPostings for ${row.broj_fakture_puni} (${amt}):`);
      console.table(p);
    } else {
      console.log(`\nNo posting for ${row.broj_fakture_puni} (${amt})`);
    }
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
