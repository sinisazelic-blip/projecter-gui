/**
 * Provjera podataka u arhivi (2006 – 31.12.2025)
 * Sve poslije toga = testiranje.
 *
 * Pokretanje: node scripts-RedDellvill/check-data-2006-2025.mjs
 */

import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i === -1) continue;
    const key = s.slice(0, i).trim();
    let val = s.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const { query } = await import("../src/lib/db.ts");

const cutoff = "2025-12-31";

function fmt(n) {
  if (n == null) return "—";
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString("bs-BA", { maximumFractionDigits: 2 }) : String(n);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PROVJERA PODATAKA: arhiva 2006 – 31.12.2025");
  console.log("  Granica: sve poslije 31.12.2025 = testiranje");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. projektni_prihodi
  console.log("1. PROJEKTNI_PRIHODI (promet)\n");
  let prihodDatumCol = "datum_prihoda";
  let prihodStatusFilter = "";
  try {
    const cols = await query(`SHOW COLUMNS FROM projektni_prihodi`);
    const colNames = (cols || []).map((c) => c.Field?.toLowerCase()).filter(Boolean);
    if (colNames.includes("datum")) prihodDatumCol = "datum";
    else if (colNames.includes("datum_prihoda")) prihodDatumCol = "datum_prihoda";
    if (colNames.includes("status")) prihodStatusFilter = "AND (status IS NULL OR status <> 'STORNIRANO')";
    console.log("   Kolona za datum:", prihodDatumCol);
  } catch (_) {}
  try {
    const prihodiRange = await query(`
      SELECT
        MIN(${prihodDatumCol}) AS min_datum,
        MAX(${prihodDatumCol}) AS max_datum,
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_prihodi
      WHERE ${prihodDatumCol} IS NOT NULL
        ${prihodStatusFilter}
    `);
    const pr = prihodiRange?.[0];
    if (pr) {
      console.log("   Opseg datuma:     ", pr.min_datum, "–", pr.max_datum);
      console.log("   Broj zapisa:      ", fmt(pr.cnt));
      console.log("   Suma iznos_km:    ", fmt(pr.sum_km));
    }

    const prihodiArhiva = await query(`
      SELECT
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_prihodi
      WHERE ${prihodDatumCol} IS NOT NULL
        AND ${prihodDatumCol} <= ?
        ${prihodStatusFilter}
    `, [cutoff]);
    const pa = prihodiArhiva?.[0];
    if (pa) {
      console.log("\n   U ARHIVI (≤31.12.2025):");
      console.log("     Broj zapisa:    ", fmt(pa.cnt));
      console.log("     Suma iznos_km:  ", fmt(pa.sum_km));
    }

    const prihodiTest = await query(`
      SELECT
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_prihodi
      WHERE ${prihodDatumCol} IS NOT NULL
        AND ${prihodDatumCol} > ?
        ${prihodStatusFilter}
    `, [cutoff]);
    const pt = prihodiTest?.[0];
    if (pt) {
      console.log("\n   TESTIRANJE (>31.12.2025):");
      console.log("     Broj zapisa:    ", fmt(pt.cnt));
      console.log("     Suma iznos_km:  ", fmt(pt.sum_km));
    }

    const prihodiPoGodini = await query(`
      SELECT
        YEAR(${prihodDatumCol}) AS godina,
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_prihodi
      WHERE ${prihodDatumCol} IS NOT NULL
        AND ${prihodDatumCol} <= ?
        ${prihodStatusFilter}
      GROUP BY YEAR(${prihodDatumCol})
      ORDER BY godina ASC
    `, [cutoff]);
    console.log("\n   Po godini (arhiva):");
    for (const r of prihodiPoGodini || []) {
      console.log("     ", r.godina, ":", fmt(r.cnt), "zapisa, suma", fmt(r.sum_km), "KM");
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  // 2. projektni_troskovi
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("2. PROJEKTNI_TROSKOVI\n");
  try {
    const troskoviRange = await query(`
      SELECT
        MIN(datum_troska) AS min_datum,
        MAX(datum_troska) AS max_datum,
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_troskovi
      WHERE status <> 'STORNIRANO' AND status IS NOT NULL
    `);
    const tr = troskoviRange?.[0];
    if (tr) {
      console.log("   Opseg datuma:     ", tr.min_datum, "–", tr.max_datum);
      console.log("   Broj zapisa:      ", fmt(tr.cnt));
      console.log("   Suma iznos_km:    ", fmt(tr.sum_km));
    }

    const troskoviArhiva = await query(`
      SELECT
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_troskovi
      WHERE status <> 'STORNIRANO' AND status IS NOT NULL
        AND datum_troska <= ?
    `, [cutoff]);
    const ta = troskoviArhiva?.[0];
    if (ta) {
      console.log("\n   U ARHIVI (≤31.12.2025):");
      console.log("     Broj zapisa:    ", fmt(ta.cnt));
      console.log("     Suma iznos_km:  ", fmt(ta.sum_km));
    }

    const troskoviTest = await query(`
      SELECT
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_troskovi
      WHERE status <> 'STORNIRANO' AND status IS NOT NULL
        AND datum_troska > ?
    `, [cutoff]);
    const tt = troskoviTest?.[0];
    if (tt) {
      console.log("\n   TESTIRANJE (>31.12.2025):");
      console.log("     Broj zapisa:    ", fmt(tt.cnt));
      console.log("     Suma iznos_km:  ", fmt(tt.sum_km));
    }

    const troskoviPoGodini = await query(`
      SELECT
        YEAR(datum_troska) AS godina,
        COUNT(*) AS cnt,
        ROUND(SUM(iznos_km), 2) AS sum_km
      FROM projektni_troskovi
      WHERE status <> 'STORNIRANO' AND status IS NOT NULL
        AND datum_troska <= ?
      GROUP BY YEAR(datum_troska)
      ORDER BY godina ASC
    `, [cutoff]);
    console.log("\n   Po godini (arhiva):");
    for (const r of troskoviPoGodini || []) {
      console.log("     ", r.godina, ":", fmt(r.cnt), "zapisa, suma", fmt(r.sum_km), "KM");
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  // 3. projekti (opseg za kontekst)
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("3. PROJEKTI (opseg za referencu)\n");
  try {
    const projektiRange = await query(`
      SELECT
        MIN(created_at) AS min_created,
        MAX(created_at) AS max_created,
        COUNT(*) AS cnt
      FROM projekti
    `);
    const pr = projektiRange?.[0];
    if (pr) {
      console.log("   Opseg created_at: ", pr.min_created, "–", pr.max_created);
      console.log("   Broj projekata:   ", fmt(pr.cnt));
    }

    const projektiDo2025 = await query(`
      SELECT COUNT(*) AS cnt
      FROM projekti
      WHERE created_at <= ?
    `, [cutoff + " 23:59:59"]);
    const pd = projektiDo2025?.[0];
    if (pd) {
      console.log("   Projekti kreirani do 31.12.2025:", fmt(pd.cnt));
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ZAVRŠETAK PROVJERE");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
}).then(() => process.exit(0));
