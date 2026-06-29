"use strict";
/**
 * Repair: stari PRENOS postingi (firma → privatni) bez blagajne → blagajna IN + link.
 *
 * Pokretanje:
 *   node scripts/repair-owner-transfer-blagajna.cjs          # dry-run
 *   node scripts/repair-owner-transfer-blagajna.cjs --apply  # upis u bazu
 */
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

function normalizeDigits(input) {
  return String(input || "").replace(/\D+/g, "");
}

function normalizeOwnerText(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const OUT_KEYWORDS = [
  "prenos",
  "isplata vlasniku",
  "isplata vlasnika",
  "placanje vlasniku",
  "transfer vlasniku",
];

function isoDate(val) {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const root = path.join(__dirname, "..");
  loadEnvLocal(root);

  const ownerDigits = normalizeDigits(process.env.FLUXA_OWNER_PRIVATE_ACCOUNT || "");
  const ownerProjectId = Number(process.env.FLUXA_OWNER_PROJECT_ID || 1) || 1;

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

  const conn = await mysql.createConnection(opts);
  console.log("DB:", process.env.DB_NAME, "@", process.env.DB_HOST);
  console.log(apply ? "MODE: APPLY" : "MODE: dry-run (dodaj --apply za upis)");

  const [rows] = await conn.execute(
    `SELECT
       p.posting_id, p.amount, DATE(p.value_date) AS value_date, p.currency, p.counterparty, p.description,
       t.reference AS staging_reference,
       t.description AS staging_description,
       t.full_description AS staging_full_description
     FROM bank_tx_posting p
     LEFT JOIN bank_tx_staging t ON t.tx_id = p.tx_id
     LEFT JOIN bank_tx_posting_placanje_link lp ON lp.posting_id = p.posting_id AND lp.aktivan = 1
     LEFT JOIN blagajna_stavke bs ON bs.transaction_details = CONCAT('owner_transfer_posting:', p.posting_id)
     WHERE p.amount < 0
       AND lp.link_id IS NULL
       AND bs.id IS NULL`,
  );

  let fixed = 0;
  let skipped = 0;

  for (const row of rows) {
    const haystack = [
      row.counterparty,
      row.description,
      row.staging_reference,
      row.staging_description,
      row.staging_full_description,
    ]
      .filter(Boolean)
      .join(" ");
    const norm = normalizeOwnerText(haystack);
    const digits = normalizeDigits(haystack);
    const isBankFee =
      norm.includes("provizija") ||
      norm.includes("bankarsk") ||
      norm.includes("naknada za");
    if (isBankFee) {
      skipped += 1;
      continue;
    }
    const hasKeyword = OUT_KEYWORDS.some((k) => norm.includes(k));
    const hasAccount = ownerDigits.length >= 10 && digits.includes(ownerDigits);
    if (!hasKeyword && !hasAccount) {
      skipped += 1;
      continue;
    }

    const postingId = Number(row.posting_id);
    const amountKm = Math.round(Math.abs(Number(row.amount)) * 100) / 100;
    const datum = isoDate(row.value_date);
    if (!datum) {
      console.error(`  SKIP #${postingId}: neispravan datum (${row.value_date})`);
      skipped += 1;
      continue;
    }
    const valuta = String(row.currency || "KM").toUpperCase();
    const marker = `owner_transfer_posting:${postingId}`;

    console.log(
      apply ? "REPAIR" : "WOULD REPAIR",
      `#${postingId}: ${amountKm} ${valuta} → blagajna IN`,
      `(${row.description || "—"})`,
    );

    if (!apply) {
      fixed += 1;
      continue;
    }

    await conn.beginTransaction();
    try {
      await conn.execute(
        `INSERT INTO blagajna_stavke
          (datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id, transaction_details, status)
         VALUES (?, ?, ?, 'IN', ?, ?, NULL, NULL, ?, 'AKTIVAN')`,
        [
          datum,
          amountKm,
          valuta === "BAM" ? "KM" : valuta,
          "Repair: prenos na privatni račun (keš).",
          ownerProjectId,
          marker,
        ],
      );

      const [insPay] = await conn.execute(
        `INSERT INTO placanja
          (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
         VALUES (?, ?, ?, 1.000000, ?, 'PRENOS_VLASNIKA', ?, ?)`,
        [
          datum,
          amountKm,
          valuta === "BAM" ? "KM" : valuta,
          amountKm,
          `prenos_vlasnika:posting_id=${postingId}`,
          `Repair prenos vlasnika [posting ${postingId}]`,
        ],
      );
      const placanjeId = insPay.insertId;
      await conn.execute(
        `INSERT INTO bank_tx_posting_placanje_link (posting_id, placanje_id, amount_km, aktivan)
         VALUES (?, ?, ?, 1)`,
        [postingId, placanjeId, amountKm],
      );

      await conn.execute(
        `INSERT INTO fin_rasknjizavanje
          (posting_id, iznos_km, vrsta, projekat_id, placanje_id, napomena, aktivan)
         VALUES (?, ?, 'PRENOS_VLASNIKA', ?, ?, 'Repair prenos → blagajna', 1)`,
        [postingId, amountKm, ownerProjectId, placanjeId],
      );

      await conn.execute(
        `UPDATE bank_tx_posting SET kategorija = 'prenos_vlasnika' WHERE posting_id = ?`,
        [postingId],
      );

      await conn.commit();
      fixed += 1;
    } catch (e) {
      await conn.rollback();
      console.error(`  FAIL #${postingId}:`, e.message);
      skipped += 1;
    }
  }

  await conn.end();
  console.log("\nDone.", { fixed, skipped, total: rows.length });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
