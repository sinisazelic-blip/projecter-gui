"use strict";
/**
 * Popravka prihoda knjiženih bez faktura_id (npr. "Income link for posting N")
 * kada posting opis sadrži broj fakture NNN/GGGG.
 *
 * Pokretanje:
 *   node scripts/repair-izvod-faktura-links.cjs          # dry-run
 *   node scripts/repair-izvod-faktura-links.cjs --apply  # upis u bazu
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

function extractBrojGodina(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  const m = s.match(/\b(\d{1,4})\s*\/\s*(\d{4})\b/);
  if (!m) return null;
  const broj = parseInt(m[1], 10);
  const godina = parseInt(m[2], 10);
  if (!Number.isFinite(broj) || !Number.isFinite(godina) || godina < 2000 || godina > 2100)
    return null;
  return { broj, godina };
}

async function findFaktura(conn, broj, godina) {
  const [rows] = await conn.execute(
    `SELECT f.faktura_id,
            (SELECT fp.projekat_id FROM faktura_projekti fp
             WHERE fp.faktura_id = f.faktura_id ORDER BY fp.projekat_id ASC LIMIT 1) AS projekat_id
     FROM fakture f
     WHERE f.broj_u_godini = ? AND f.godina = ?
       AND (f.fiskalni_status IS NULL OR TRIM(UPPER(f.fiskalni_status)) NOT IN ('STORNIRAN','ZAMIJENJEN'))
     LIMIT 1`,
    [broj, godina],
  );
  const r = rows?.[0];
  if (!r?.faktura_id) return null;
  return {
    faktura_id: Number(r.faktura_id),
    projekat_id: r.projekat_id != null ? Number(r.projekat_id) : 0,
  };
}

async function findFakturaByPoziv(conn, poziv8) {
  const [rows] = await conn.execute(
    `SELECT f.faktura_id,
            (SELECT fp.projekat_id FROM faktura_projekti fp
             WHERE fp.faktura_id = f.faktura_id ORDER BY fp.projekat_id ASC LIMIT 1) AS projekat_id
     FROM fakture f
     WHERE f.poziv_na_broj = ?
       AND (f.fiskalni_status IS NULL OR TRIM(UPPER(f.fiskalni_status)) NOT IN ('PLACENA','DJELIMICNO','PAID','PLACENO','STORNIRAN','ZAMIJENJEN'))
     LIMIT 1`,
    [poziv8],
  );
  const r = rows?.[0];
  if (!r?.faktura_id) return null;
  return {
    faktura_id: Number(r.faktura_id),
    projekat_id: r.projekat_id != null ? Number(r.projekat_id) : 0,
  };
}

async function findFakturaByAmount(conn, amountKm, godina = null) {
  const amt = Math.round(Number(amountKm) * 100) / 100;
  if (!(amt > 0)) return null;
  const [rows] = await conn.execute(
    `SELECT f.faktura_id,
            (SELECT fp.projekat_id FROM faktura_projekti fp
             WHERE fp.faktura_id = f.faktura_id ORDER BY fp.projekat_id ASC LIMIT 1) AS projekat_id
     FROM fakture f
     WHERE ROUND(COALESCE(f.iznos_ukupno_km, 0), 2) = ?
       AND (? IS NULL OR f.godina = ?)
       AND (f.fiskalni_status IS NULL OR TRIM(UPPER(f.fiskalni_status)) NOT IN ('PLACENA','DJELIMICNO','PAID','PLACENO','STORNIRAN','ZAMIJENJEN'))
     ORDER BY f.faktura_id DESC`,
    [amt, godina, godina],
  );
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const r = rows[0];
  return {
    faktura_id: Number(r.faktura_id),
    projekat_id: r.projekat_id != null ? Number(r.projekat_id) : 0,
    match_by: "amount",
  };
}

function isFinanceToolsOrphan(row) {
  return /Income link for posting \d+/i.test(String(row.opis || ""));
}

async function resolveMatch(conn, row) {
  const haystack = [
    row.reference,
    row.staging_desc,
    row.full_description,
    row.posting_desc,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join("\n");

  const ref = extractBrojGodina(haystack);
  if (ref) {
    const m = await findFaktura(conn, ref.broj, ref.godina);
    if (m) return { ...m, match_by: "broj", label: `${ref.broj}/${ref.godina}` };
  }

  if (isFinanceToolsOrphan(row)) {
    const pozivMatch = haystack.match(/\b(\d{8})\b/);
    if (pozivMatch) {
      const m = await findFakturaByPoziv(conn, pozivMatch[1]);
      if (m) return { ...m, match_by: "poziv", label: pozivMatch[1] };
    }

    const amt = Math.abs(Number(row.amount ?? row.iznos_km));
    const valueDate = String(row.value_date || "").slice(0, 10);
    const godina = /^\d{4}/.test(valueDate) ? Number(valueDate.slice(0, 4)) : null;
    const m = await findFakturaByAmount(conn, amt, godina);
    if (m) return { ...m, label: `iznos ${amt}` };
  }

  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
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

  const conn = await mysql.createConnection(opts);
  console.log("DB:", process.env.DB_NAME, "@", process.env.DB_HOST);
  console.log(apply ? "MODE: APPLY" : "MODE: dry-run (dodaj --apply za upis)");

  const [candidates] = await conn.execute(
    `SELECT pr.prihod_id, pr.faktura_id, pr.projekat_id, pr.iznos_km, pr.opis,
            p.posting_id, p.description AS posting_desc, p.amount, p.value_date,
            t.reference, t.description AS staging_desc, t.full_description
     FROM projektni_prihodi pr
     JOIN bank_tx_posting_prihod_link l ON l.prihod_id = pr.prihod_id AND l.aktivan = 1
     JOIN bank_tx_posting p ON p.posting_id = l.posting_id
     LEFT JOIN bank_tx_staging t ON t.tx_id = p.tx_id
     WHERE (pr.faktura_id IS NULL OR pr.faktura_id = 0)
       AND p.amount > 0
     ORDER BY pr.prihod_id ASC`,
  );

  let repaired = 0;
  let skipped = 0;

  for (const row of candidates || []) {
    const match = await resolveMatch(conn, row);
    if (!match?.faktura_id) {
      skipped += 1;
      continue;
    }

    const targetProjekat =
      match.projekat_id > 0 ? match.projekat_id : Number(row.projekat_id) || 1;

    console.log(
      apply ? "REPAIR" : "WOULD REPAIR",
      `prihod=${row.prihod_id} posting=${row.posting_id}`,
      `${match.label} (${match.match_by}) -> faktura_id=${match.faktura_id} projekat_id=${targetProjekat}`,
      `(${row.opis})`,
    );

    if (apply) {
      await conn.beginTransaction();
      try {
        await conn.execute(
          `UPDATE projektni_prihodi
           SET faktura_id = ?, projekat_id = ?
           WHERE prihod_id = ?`,
          [match.faktura_id, targetProjekat, row.prihod_id],
        );
        await conn.execute(
          `UPDATE fakture SET fiskalni_status = 'PLACENA' WHERE faktura_id = ?`,
          [match.faktura_id],
        );
        await conn.commit();
        repaired += 1;
      } catch (e) {
        await conn.rollback();
        console.error("FAIL prihod", row.prihod_id, e.message);
        skipped += 1;
      }
    } else {
      repaired += 1;
    }
  }

  console.log("\nDone.", { repaired, skipped, total: (candidates || []).length });
  await conn.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
