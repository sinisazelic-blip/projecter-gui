"use strict";
/**
 * Repair: Fructa dupla uplata 29.04. (posting #151) + zatvaranje 024/2026.
 *
 * Logika:
 * - posting 151 (2143.44) → 2007.72 na 022/2026 + 135.72 na 024/2026
 * - posting 264 linkovi usklađeni sa stvarnim prihod iznosima (fix OVER_ALLOCATED)
 *
 *   node scripts/repair-fructa-double-payment.cjs          # dry-run
 *   node scripts/repair-fructa-double-payment.cjs --apply
 */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const POSTING_DUP = 151;
const POSTING_024 = 264;
const FAKTURA_022 = 55;
const FAKTURA_024 = 57;
const AMT_022 = 2007.72;
const AMT_024_CREDIT = 135.72;
const PRIHOD_ORPHAN = 78;

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

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function isoDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function invoiceProjects(conn, fakturaId) {
  const [rows] = await conn.execute(
    `SELECT projekat_id FROM faktura_projekti WHERE faktura_id = ? ORDER BY projekat_id ASC`,
    [fakturaId],
  );
  return rows.map((r) => Number(r.projekat_id)).filter((x) => x > 0);
}

async function createPrihodSplit(conn, { fakturaId, amountKm, datum, opis }) {
  const projects = await invoiceProjects(conn, fakturaId);
  if (!projects.length) throw new Error(`Faktura ${fakturaId} nema projekata`);

  const total = round2(amountKm);
  const per = Math.floor((total / projects.length) * 100) / 100;
  let remainder = round2(total - per * projects.length);
  const parts = [];

  for (let i = 0; i < projects.length; i++) {
    const extra = remainder > 0 ? 0.01 : 0;
    if (remainder > 0) remainder = round2(remainder - 0.01);
    const part = round2(per + extra);
    if (part <= 0) continue;

    const [ins] = await conn.execute(
      `INSERT INTO projektni_prihodi (projekat_id, faktura_id, datum_prihoda, iznos_km, opis)
       VALUES (?, ?, ?, ?, ?)`,
      [projects[i], fakturaId, datum, part, opis.slice(0, 255)],
    );
    parts.push({ prihodId: ins.insertId, amountKm: part });
  }
  return parts;
}

async function syncFakturaStatus(conn, fakturaId) {
  const [totRows] = await conn.execute(
    `SELECT ROUND(COALESCE(iznos_ukupno_km, 0), 2) AS total FROM fakture WHERE faktura_id = ?`,
    [fakturaId],
  );
  const total = round2(totRows[0]?.total ?? 0);
  const [paidRows] = await conn.execute(
    `SELECT ROUND(COALESCE(SUM(iznos_km), 0), 2) AS s FROM projektni_prihodi WHERE faktura_id = ?`,
    [fakturaId],
  );
  const paid = round2(paidRows[0]?.s ?? 0);
  let status = "DODIJELJEN";
  if (paid <= 0.01) status = "DODIJELJEN";
  else if (paid + 0.01 < total) status = "DJELIMICNO";
  else status = "PLACENA";
  await conn.execute(`UPDATE fakture SET fiskalni_status = ? WHERE faktura_id = ?`, [
    status,
    fakturaId,
  ]);
  return { total, paid, status };
}

async function fixPosting264Links(conn, apply) {
  const [links] = await conn.execute(
    `SELECT l.link_id, l.prihod_id, l.amount_km, pr.iznos_km
     FROM bank_tx_posting_prihod_link l
     JOIN projektni_prihodi pr ON pr.prihod_id = l.prihod_id
     WHERE l.posting_id = ? AND l.aktivan = 1
     ORDER BY l.link_id`,
    [POSTING_024],
  );

  const fixes = [];
  for (const row of links) {
    const want = round2(row.iznos_km);
    const have = round2(row.amount_km);
    if (Math.abs(want - have) > 0.001) {
      fixes.push({ link_id: row.link_id, prihod_id: row.prihod_id, from: have, to: want });
      if (apply) {
        await conn.execute(
          `UPDATE bank_tx_posting_prihod_link SET amount_km = ? WHERE link_id = ?`,
          [want, row.link_id],
        );
        await conn.execute(
          `UPDATE fin_rasknjizavanje SET iznos_km = ? WHERE posting_id = ? AND prihod_id = ? AND aktivan = 1`,
          [want, POSTING_024, row.prihod_id],
        );
      }
    }
  }
  return fixes;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const root = path.join(__dirname, "..");
  loadEnvLocal(root);

  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: String(process.env.DB_NAME || "").split("#")[0].trim(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const [p151] = await db.execute(
      `SELECT posting_id, amount, value_date, description FROM bank_tx_posting WHERE posting_id = ?`,
      [POSTING_DUP],
    );
    if (!p151.length) throw new Error(`Posting ${POSTING_DUP} nije pronađen`);

    const [orphan] = await db.execute(`SELECT * FROM projektni_prihodi WHERE prihod_id = ?`, [
      PRIHOD_ORPHAN,
    ]);

    const [inv] = await db.execute(
      `SELECT faktura_id, broj_fakture_puni, iznos_ukupno_km,
              (SELECT ROUND(COALESCE(SUM(pr.iznos_km),0),2) FROM projektni_prihodi pr WHERE pr.faktura_id=f.faktura_id) AS placeno
       FROM fakture f WHERE f.faktura_id IN (?, ?)`,
      [FAKTURA_022, FAKTURA_024],
    );

    const [san264] = await db.execute(
      `SELECT linked_total_km, alloc_status FROM v_bank_posting_sanity WHERE posting_id = ?`,
      [POSTING_024],
    );

    const plan = {
      mode: apply ? "APPLY" : "DRY-RUN",
      posting_151: p151[0],
      orphan_prihod_78: orphan[0] ?? null,
      invoices_before: inv,
      posting_264_sanity: san264[0] ?? null,
      actions: [
        `Deaktivirati prihod #${PRIHOD_ORPHAN} i link na posting ${POSTING_DUP}`,
        `Kreirati prihode: ${AMT_022} → faktura ${FAKTURA_022}, ${AMT_024_CREDIT} → faktura ${FAKTURA_024}`,
        `Linkovati posting ${POSTING_DUP} na nove prihode`,
        `Uskladiti link iznose postinga ${POSTING_024}`,
        "Sync statusa faktura 022 i 024",
      ],
    };

    console.log(JSON.stringify(plan, null, 2));

    if (!apply) {
      const fixes = await fixPosting264Links(db, false);
      console.log("posting_264_link_fixes_preview:", fixes);
      await db.end();
      return;
    }

    await db.beginTransaction();

    await db.execute(`UPDATE bank_tx_posting_prihod_link SET aktivan = 0 WHERE posting_id = ?`, [
      POSTING_DUP,
    ]);
    await db.execute(`DELETE FROM projektni_prihodi WHERE prihod_id = ?`, [PRIHOD_ORPHAN]);

    const datum = isoDate(p151[0].value_date) || "2026-04-30";
    const opis022 = "Repair: dupla uplata Fructa → 022/2026";
    const opis024 = "Repair: višak duplog plaćanja → 024/2026";

    const parts022 = await createPrihodSplit(db, {
      fakturaId: FAKTURA_022,
      amountKm: AMT_022,
      datum,
      opis: opis022,
    });
    const parts024 = await createPrihodSplit(db, {
      fakturaId: FAKTURA_024,
      amountKm: AMT_024_CREDIT,
      datum,
      opis: opis024,
    });

    for (const part of parts022) {
      await db.execute(
        `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan)
         VALUES (?, ?, ?, 1)`,
        [POSTING_DUP, part.prihodId, part.amountKm],
      );
      await db.execute(
        `INSERT INTO fin_rasknjizavanje
          (posting_id, iznos_km, vrsta, faktura_id, klijent_id, prihod_id, napomena, aktivan)
         VALUES (?, ?, 'NAPLATA_FAKTURE', ?, 49, ?, ?, 1)`,
        [POSTING_DUP, part.amountKm, FAKTURA_022, part.prihodId, opis022],
      );
    }
    for (const part of parts024) {
      await db.execute(
        `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan)
         VALUES (?, ?, ?, 1)`,
        [POSTING_DUP, part.prihodId, part.amountKm],
      );
      await db.execute(
        `INSERT INTO fin_rasknjizavanje
          (posting_id, iznos_km, vrsta, faktura_id, klijent_id, prihod_id, napomena, aktivan)
         VALUES (?, ?, 'NAPLATA_FAKTURE', ?, 49, ?, ?, 1)`,
        [POSTING_DUP, part.amountKm, FAKTURA_024, part.prihodId, opis024],
      );
    }

    const fixes264 = await fixPosting264Links(db, true);
    const st022 = await syncFakturaStatus(db, FAKTURA_022);
    const st024 = await syncFakturaStatus(db, FAKTURA_024);

    const [sanAfter] = await db.execute(
      `SELECT posting_id, linked_total_km, alloc_status FROM v_bank_posting_sanity WHERE posting_id IN (?, ?)`,
      [POSTING_DUP, POSTING_024],
    );

    await db.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          posting_264_link_fixes: fixes264,
          faktura_022: st022,
          faktura_024: st024,
          sanity_after: sanAfter,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    try {
      await db.rollback();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
