"use strict";
const fs = require("node:fs");
const mysql = require("mysql2/promise");

function loadEnv() {
  const txt = fs.readFileSync(".env.local", "utf8");
  for (const raw of txt.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if (!(v.startsWith('"') || v.startsWith("'"))) v = v.replace(/\s+#.*$/, "").trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function run() {
  loadEnv();
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
  const one = async (sql) => {
    const [r] = await c.query(sql);
    return r[0]?.c ?? 0;
  };
  const out = {
    fakture: await one("SELECT COUNT(*) c FROM fakture"),
    faktura_projekti: await one("SELECT COUNT(*) c FROM faktura_projekti"),
    join_all: await one("SELECT COUNT(*) c FROM fakture f JOIN faktura_projekti fp ON fp.faktura_id = f.faktura_id"),
    fakture_valid: await one("SELECT COUNT(*) c FROM fakture f WHERE (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN','ZAMIJENJEN'))"),
    join_valid: await one("SELECT COUNT(*) c FROM fakture f JOIN faktura_projekti fp ON fp.faktura_id = f.faktura_id WHERE (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN','ZAMIJENJEN'))"),
    due_range_count: await one(`
      SELECT COUNT(*) c
      FROM faktura_projekti fp
      JOIN projekti p ON p.projekat_id = fp.projekat_id
      JOIN fakture f ON f.faktura_id = fp.faktura_id
      LEFT JOIN klijenti kn ON kn.klijent_id = f.bill_to_klijent_id
      WHERE (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN','ZAMIJENJEN'))
        AND DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) >= '2026-01-01'
        AND DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) <= '2026-04-28'
    `),
  };
  console.log(out);
  await c.end();
}

run().catch((e) => {
  console.error("DEBUG_FAILED", e?.message || e);
  process.exit(1);
});

