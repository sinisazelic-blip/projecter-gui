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
      if (process.env[key] === undefined) process.env[key] = v;
    }
    return;
  }
}

async function main() {
  const root = path.join(__dirname, "..");
  loadEnvLocal(root);
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
  });

  const [inv] = await c.query(
    `SELECT faktura_id, broj_fakture_puni, datum_izdavanja, created_at
     FROM fakture WHERE broj_u_godini >= 25 AND godina = 2026 ORDER BY broj_u_godini`,
  );
  console.log("=== INVOICES 25+/2026 ===");
  console.table(inv);

  const [links] = await c.query(
    `SELECT p.posting_id, p.description, p.amount, l.created_at AS link_at,
            pr.prihod_id, pr.faktura_id, pr.projekat_id, pr.opis
     FROM bank_tx_posting p
     JOIN bank_tx_posting_prihod_link l ON l.posting_id = p.posting_id AND l.aktivan = 1
     JOIN projektni_prihodi pr ON pr.prihod_id = l.prihod_id
     WHERE p.description REGEXP '[0-9]{1,4}/2026'
     ORDER BY p.posting_id`,
  );
  console.log("\n=== POSTINGS WITH INVOICE-LIKE DESCRIPTION ===");
  console.table(links);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
