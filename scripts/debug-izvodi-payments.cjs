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

async function main() {
  const root = path.join(__dirname, "..");
  loadEnvLocal(root);
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const opts = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port,
  };
  if (port === 25060 || process.env.DB_SSL === "1" || process.env.DB_SSL === "true") {
    opts.ssl = { rejectUnauthorized: false };
  }
  const c = await mysql.createConnection(opts);
  console.log("DB:", process.env.DB_NAME, "@", process.env.DB_HOST);

  const [batches] = await c.query(
    `SELECT batch_id, status, statement_date, statement_no, imported_at
     FROM bank_import_batch ORDER BY batch_id DESC LIMIT 10`,
  );
  console.log("\n=== RECENT BATCHES ===");
  console.table(batches);

  const [unposted] = await c.query(
    `SELECT COUNT(*) AS cnt FROM bank_import_batch WHERE status IS NULL OR status <> 'posted'`,
  );
  console.log("Unposted batches:", unposted[0].cnt);

  const [recentInv] = await c.query(
    `SELECT f.faktura_id, f.broj_u_godini, f.godina, f.broj_fakture_puni, f.poziv_na_broj,
            f.fiskalni_status, f.iznos_ukupno_km,
            (SELECT COUNT(*) FROM faktura_projekti fp WHERE fp.faktura_id = f.faktura_id) AS proj_cnt
     FROM fakture f ORDER BY f.faktura_id DESC LIMIT 8`,
  );
  console.log("\n=== RECENT INVOICES ===");
  console.table(recentInv);

  const [prihodi] = await c.query(
    `SELECT pr.prihod_id, pr.faktura_id, pr.projekat_id, pr.datum_prihoda, pr.iznos_km, pr.opis
     FROM projektni_prihodi pr
     ORDER BY pr.prihod_id DESC LIMIT 10`,
  );
  console.log("\n=== RECENT PROJEKTNI_PRIHODI ===");
  console.table(prihodi);

  const [postings] = await c.query(
    `SELECT p.posting_id, p.batch_id, p.amount, p.description, p.value_date,
            (SELECT COUNT(*) FROM bank_tx_posting_prihod_link l WHERE l.posting_id = p.posting_id AND l.aktivan=1) AS prihod_links
     FROM bank_tx_posting p
     ORDER BY p.posting_id DESC LIMIT 10`,
  );
  console.log("\n=== RECENT POSTINGS ===");
  console.table(postings);

  const [unmatched] = await c.query(
    `SELECT b.batch_id, COUNT(*) AS unmatched_cnt
     FROM bank_tx_staging t
     JOIN bank_import_batch b ON b.batch_id = t.batch_id
     LEFT JOIN bank_tx_match m ON m.tx_id = t.tx_id
     WHERE m.tx_id IS NULL AND (b.status IS NULL OR b.status <> 'posted')
     GROUP BY b.batch_id
     ORDER BY b.batch_id DESC LIMIT 5`,
  );
  console.log("\n=== BATCHES WITH UNMATCHED (not posted) ===");
  console.table(unmatched);

  const [cols] = await c.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fakture'
       AND COLUMN_NAME IN ('poziv_na_broj','fiskalni_status')`,
  );
  console.log("\n=== FAKTURE COLUMNS ===", cols.map((r) => r.COLUMN_NAME));

  const [fakturaIdCol] = await c.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projektni_prihodi'
       AND COLUMN_NAME = 'faktura_id'`,
  );
  console.log("projektni_prihodi.faktura_id:", fakturaIdCol.length > 0 ? "YES" : "NO");

  const postingId = Number(process.argv[2] || 261);
  const [p] = await c.query(
    `SELECT posting_id, description, amount, batch_id FROM bank_tx_posting WHERE posting_id = ?`,
    [postingId],
  );
  console.log(`\n=== POSTING ${postingId} ===`, p[0]);
  const [st] = await c.query(
    `SELECT t.reference, t.description, t.full_description
     FROM bank_tx_staging t JOIN bank_tx_posting p ON p.tx_id = t.tx_id WHERE p.posting_id = ?`,
    [postingId],
  );
  console.log("STAGING:", st[0]);
  const [link] = await c.query(
    `SELECT l.link_id, pr.prihod_id, pr.faktura_id, pr.projekat_id, pr.opis
     FROM bank_tx_posting_prihod_link l
     JOIN projektni_prihodi pr ON pr.prihod_id = l.prihod_id
     WHERE l.posting_id = ? AND l.aktivan = 1`,
    [postingId],
  );
  console.log("PRIHOD LINK:", link[0]);

  const desc = String(p[0]?.description || "");
  const m = desc.match(/\b(\d{1,4})\s*\/\s*(\d{4})\b/);
  if (m) {
    const broj = parseInt(m[1], 10);
    const godina = parseInt(m[2], 10);
    const [inv] = await c.query(
      `SELECT faktura_id, broj_u_godini, godina, fiskalni_status, poziv_na_broj
       FROM fakture WHERE broj_u_godini = ? AND godina = ?`,
      [broj, godina],
    );
    console.log(`INVOICE MATCH ${broj}/${godina}:`, inv[0]);
  }

  const [enumCol] = await c.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fakture' AND COLUMN_NAME = 'fiskalni_status'`,
  );
  console.log("fiskalni_status enum:", enumCol[0]?.COLUMN_TYPE);

  await c.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
