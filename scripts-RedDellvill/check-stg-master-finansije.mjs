/**
 * Provjera tabele stg_master_finansije
 * - struktura, opseg datum_zavrsetka
 * - raspodjela po ID_PO (redova po projektu)
 * - veza sa projekti.id_po
 *
 * Pokretanje: node scripts-RedDellvill/check-stg-master-finansije.mjs
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
  return Number.isFinite(x)
    ? x.toLocaleString("bs-BA", { maximumFractionDigits: 2 })
    : String(n);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PROVJERA: stg_master_finansije");
  console.log("  Kolone: ID_PO, iznos_km, iznos_troska_km, datum_zavrsetka");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Struktura
  console.log("1. STRUKTURA TABELE\n");
  try {
    const cols = await query(`SHOW COLUMNS FROM stg_master_finansije`);
    for (const c of cols || []) {
      console.log("   ", c.Field, "|", c.Type, "|", c.Null, "|", c.Key || "-");
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
    return;
  }

  // 2. Opseg i ukupno
  console.log("\n2. OPSEG I UKUPNO\n");
  try {
    const range = await query(`
      SELECT
        MIN(datum_zavrsetka) AS min_datum,
        MAX(datum_zavrsetka) AS max_datum,
        COUNT(*) AS cnt,
        COUNT(DISTINCT ID_PO) AS distinct_id_po,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS sum_iznos_km,
        ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS sum_iznos_troska_km
      FROM stg_master_finansije
    `);
    const r = range?.[0];
    if (r) {
      console.log("   Opseg datum_zavrsetka:", r.min_datum, "–", r.max_datum);
      console.log("   Broj redova:         ", fmt(r.cnt));
      console.log("   Različitih ID_PO:    ", fmt(r.distinct_id_po));
      console.log("   Suma iznos_km:       ", fmt(r.sum_iznos_km), "KM");
      console.log("   Suma iznos_troska_km:", fmt(r.sum_iznos_troska_km), "KM");
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  // 3. Koliko redova po ID_PO
  console.log("\n3. REDOVA PO ID_PO\n");
  try {
    const perIdPo = await query(`
      SELECT
        MIN(c) AS min_rows,
        MAX(c) AS max_rows,
        AVG(c) AS avg_rows
      FROM (
        SELECT ID_PO, COUNT(*) AS c
        FROM stg_master_finansije
        GROUP BY ID_PO
      ) t
    `);
    const p = perIdPo?.[0];
    if (p) {
      console.log("   Min redova po ID_PO: ", fmt(p.min_rows));
      console.log("   Max redova po ID_PO: ", fmt(p.max_rows));
      console.log("   Prosjek redova:      ", fmt(p.avg_rows));
    }

    const multiRows = await query(`
      SELECT ID_PO, COUNT(*) AS cnt
      FROM stg_master_finansije
      GROUP BY ID_PO
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 10
    `);
    if (multiRows?.length) {
      console.log("\n   Primjeri ID_PO sa više redova:");
      for (const row of multiRows) {
        console.log("     ID_PO", row.ID_PO, ":", row.cnt, "redova");
      }
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  // 4. Projekti u minusu (po ID_PO, zarada < 0)
  console.log("\n4. ID_PO SA ZARADOM U MINUSU (iznos_km - iznos_troska_km < 0)\n");
  try {
    const minus = await query(`
      SELECT
        ID_PO,
        COUNT(*) AS cnt,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS sum_iznos_km,
        ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS sum_troska,
        ROUND(SUM(COALESCE(iznos_km, 0)) - SUM(COALESCE(iznos_troska_km, 0)), 2) AS zarada
      FROM stg_master_finansije
      GROUP BY ID_PO
      HAVING (SUM(COALESCE(iznos_km, 0)) - SUM(COALESCE(iznos_troska_km, 0))) < 0
      ORDER BY zarada ASC
      LIMIT 15
    `);
    if (minus?.length) {
      for (const row of minus) {
        console.log("     ID_PO", row.ID_PO, "| redova:", row.cnt, "| promet:", fmt(row.sum_iznos_km), "| trošak:", fmt(row.sum_troska), "| zarada:", fmt(row.zarada));
      }
      const cntMinus = await query(`
        SELECT COUNT(*) AS c FROM (
          SELECT ID_PO FROM stg_master_finansije
          GROUP BY ID_PO
          HAVING (SUM(COALESCE(iznos_km, 0)) - SUM(COALESCE(iznos_troska_km, 0))) < 0
        ) t
      `);
      console.log("\n   Ukupno ID_PO u minusu:", cntMinus?.[0]?.c ?? "?");
    } else {
      console.log("   Nema ID_PO u minusu.");
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  // 5. Veza sa projekti
  console.log("\n5. VEZA SA projekti.id_po\n");
  try {
    const link = await query(`
      SELECT
        (SELECT COUNT(DISTINCT ID_PO) FROM stg_master_finansije) AS stg_id_po,
        (SELECT COUNT(DISTINCT id_po) FROM projekti WHERE id_po IS NOT NULL) AS proj_id_po,
        (SELECT COUNT(*) FROM projekti p
         WHERE EXISTS (SELECT 1 FROM stg_master_finansije s WHERE s.ID_PO = p.id_po)) AS projekti_koji_imaju_stg
    `);
    const l = link?.[0];
    if (l) {
      console.log("   Različitih ID_PO u stg:        ", fmt(l.stg_id_po));
      console.log("   Različitih id_po u projekti:   ", fmt(l.proj_id_po));
      console.log("   Projekata sa match u stg:      ", fmt(l.projekti_koji_imaju_stg));
    }

    const noMatch = await query(`
      SELECT s.ID_PO
      FROM (SELECT DISTINCT ID_PO FROM stg_master_finansije) s
      LEFT JOIN projekti p ON p.id_po = s.ID_PO
      WHERE p.projekat_id IS NULL
      LIMIT 10
    `);
    if (noMatch?.length) {
      console.log("\n   Primjeri ID_PO iz stg koji NEMA u projekti:", noMatch.map((r) => r.ID_PO).join(", "));
      const cntNoMatch = await query(`
        SELECT COUNT(*) AS c FROM (
          SELECT s.ID_PO FROM (SELECT DISTINCT ID_PO FROM stg_master_finansije) s
          LEFT JOIN projekti p ON p.id_po = s.ID_PO
          WHERE p.projekat_id IS NULL
        ) t
      `);
      console.log("   Ukupno ID_PO bez matcha:", cntNoMatch?.[0]?.c ?? "?");
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  // 6. Arhiva vs testiranje (datum_zavrsetka)
  console.log("\n6. ARHIVA (≤31.12.2025) vs TESTIRANJE\n");
  try {
    const arhiva = await query(`
      SELECT
        COUNT(*) AS cnt,
        COUNT(DISTINCT ID_PO) AS id_po_cnt,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS sum_km,
        ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS sum_troska
      FROM stg_master_finansije
      WHERE datum_zavrsetka <= ?
    `, [cutoff]);
    const a = arhiva?.[0];
    if (a) {
      console.log("   Arhiva (≤31.12.2025):");
      console.log("     Redova:", fmt(a.cnt), "| ID_PO:", fmt(a.id_po_cnt), "| promet:", fmt(a.sum_km), "| trošak:", fmt(a.sum_troska));
    }

    const test = await query(`
      SELECT
        COUNT(*) AS cnt,
        COUNT(DISTINCT ID_PO) AS id_po_cnt,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS sum_km,
        ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS sum_troska
      FROM stg_master_finansije
      WHERE datum_zavrsetka > ?
    `, [cutoff]);
    const t = test?.[0];
    if (t) {
      console.log("   Testiranje (>31.12.2025):");
      console.log("     Redova:", fmt(t.cnt), "| ID_PO:", fmt(t.id_po_cnt), "| promet:", fmt(t.sum_km), "| trošak:", fmt(t.sum_troska));
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  // 7. Po godini (arhiva) – agregacija po ID_PO pa godini
  console.log("\n7. PO GODINI (arhiva, sumirano po ID_PO pa godini)\n");
  try {
    const poGodini = await query(`
      SELECT
        YEAR(datum_zavrsetka) AS godina,
        COUNT(DISTINCT ID_PO) AS id_po_cnt,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS sum_km,
        ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS sum_troska,
        ROUND(SUM(COALESCE(iznos_km, 0)) - SUM(COALESCE(iznos_troska_km, 0)), 2) AS zarada
      FROM stg_master_finansije
      WHERE datum_zavrsetka <= ?
      GROUP BY YEAR(datum_zavrsetka)
      ORDER BY godina ASC
    `, [cutoff]);
    if (poGodini?.length) {
      for (const r of poGodini) {
        console.log("   ", r.godina, "| ID_PO:", fmt(r.id_po_cnt), "| promet:", fmt(r.sum_km), "| trošak:", fmt(r.sum_troska), "| zarada:", fmt(r.zarada));
      }
    }
  } catch (e) {
    console.log("   GREŠKA:", e.message);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ZAVRŠETAK");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
