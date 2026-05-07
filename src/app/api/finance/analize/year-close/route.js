import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function yearRange(year) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

async function trosakDateExpr(alias = "t") {
  const cols = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'projektni_troskovi'`,
  ).catch(() => []);
  const set = new Set((cols || []).map((c) => String(c.column_name)));
  const parts = [];
  if (set.has("datum_troska")) parts.push(`${alias}.datum_troska`);
  if (set.has("datum_nastanka")) parts.push(`${alias}.datum_nastanka`);
  parts.push(`${alias}.created_at`);
  return `COALESCE(${parts.join(", ")})`;
}

async function prihodDateExpr(alias = "pr") {
  const cols = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'projektni_prihodi'`,
  ).catch(() => []);
  const set = new Set((cols || []).map((c) => String(c.column_name)));
  const parts = [];
  if (set.has("datum_prihoda")) parts.push(`${alias}.datum_prihoda`);
  if (set.has("datum")) parts.push(`${alias}.datum`);
  parts.push(`${alias}.created_at`);
  return `COALESCE(${parts.join(", ")})`;
}

async function clientBalances(year) {
  const { from, to } = yearRange(year);
  const prDt = await prihodDateExpr("pr");
  const rows = await query(
    `
    SELECT k.klijent_id AS partner_id,
      COALESCE(ps.pocetno, 0) + COALESCE(fi.fakturisano, 0) - COALESCE(na.naplaceno, 0) - COALESCE(nc.naplaceno, 0) - COALESCE(bn.naplaceno, 0) AS saldo
    FROM klijenti k
    LEFT JOIN (
      SELECT p.klijent_id, ROUND(SUM(GREATEST(0, COALESCE(p.iznos_potrazuje,0) - COALESCE(u.paid_km,0))), 2) AS pocetno
      FROM klijent_pocetno_stanje p
      LEFT JOIN (
        SELECT ref_id, ROUND(SUM(COALESCE(amount_km,0)),2) AS paid_km
        FROM pocetno_stanje_uplate WHERE tip='klijent' AND aktivan=1
        GROUP BY ref_id
      ) u ON u.ref_id = p.klijent_id
      WHERE COALESCE(p.otpisano,0)=0
      GROUP BY p.klijent_id
    ) ps ON ps.klijent_id = k.klijent_id
    LEFT JOIN (
      SELECT f.bill_to_klijent_id AS klijent_id, ROUND(SUM(COALESCE(f.iznos_ukupno_km,0)),2) AS fakturisano
      FROM fakture f
      WHERE f.bill_to_klijent_id IS NOT NULL
        AND DATE(f.datum_izdavanja) >= ? AND DATE(f.datum_izdavanja) <= ?
        AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN','ZAMIJENJEN'))
      GROUP BY f.bill_to_klijent_id
    ) fi ON fi.klijent_id = k.klijent_id
    LEFT JOIN (
      SELECT COALESCE(NULLIF(fpr.bill_to_klijent_id, 0), NULLIF(p.narucilac_id, 0), NULLIF(p.krajnji_klijent_id, 0), NULLIF(pc.klijent_id, 0)) AS klijent_id,
             ROUND(SUM(COALESCE(pr.iznos_km,0)),2) AS naplaceno
      FROM projektni_prihodi pr
      LEFT JOIN fakture fpr ON fpr.faktura_id = pr.faktura_id
      JOIN projekti p ON p.projekat_id = pr.projekat_id
      LEFT JOIN (
        SELECT
          fp.projekat_id,
          MIN(f.bill_to_klijent_id) AS klijent_id
        FROM faktura_projekti fp
        JOIN fakture f ON f.faktura_id = fp.faktura_id
        WHERE f.bill_to_klijent_id IS NOT NULL
          AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN','ZAMIJENJEN'))
        GROUP BY fp.projekat_id
      ) pc ON pc.projekat_id = pr.projekat_id
      WHERE DATE(${prDt}) >= ? AND DATE(${prDt}) <= ?
      GROUP BY COALESCE(NULLIF(fpr.bill_to_klijent_id, 0), NULLIF(p.narucilac_id, 0), NULLIF(p.krajnji_klijent_id, 0), NULLIF(pc.klijent_id, 0))
    ) na ON na.klijent_id = k.klijent_id
    LEFT JOIN (
      SELECT
        COALESCE(
          CASE WHEN LOWER(COALESCE(c.entity_type, '')) IN ('klijent', 'client') THEN NULLIF(c.entity_id, 0) ELSE NULL END,
          NULLIF(p.narucilac_id, 0),
          NULLIF(p.krajnji_klijent_id, 0),
          NULLIF(pc.klijent_id, 0)
        ) AS klijent_id,
        ROUND(SUM(COALESCE(c.iznos, 0)), 2) AS naplaceno
      FROM blagajna_stavke c
      LEFT JOIN projekti p ON p.projekat_id = c.project_id
      LEFT JOIN (
        SELECT
          fp.projekat_id,
          MIN(f.bill_to_klijent_id) AS klijent_id
        FROM faktura_projekti fp
        JOIN fakture f ON f.faktura_id = fp.faktura_id
        WHERE f.bill_to_klijent_id IS NOT NULL
          AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN','ZAMIJENJEN'))
        GROUP BY fp.projekat_id
      ) pc ON pc.projekat_id = c.project_id
      WHERE c.smjer = 'IN'
        AND COALESCE(c.status, 'AKTIVAN') = 'AKTIVAN'
        AND DATE(COALESCE(c.datum, c.created_at)) >= ? AND DATE(COALESCE(c.datum, c.created_at)) <= ?
      GROUP BY COALESCE(
        CASE WHEN LOWER(COALESCE(c.entity_type, '')) IN ('klijent', 'client') THEN NULLIF(c.entity_id, 0) ELSE NULL END,
        NULLIF(p.narucilac_id, 0),
        NULLIF(p.krajnji_klijent_id, 0),
        NULLIF(pc.klijent_id, 0)
      )
    ) nc ON nc.klijent_id = k.klijent_id
    LEFT JOIN (
      SELECT
        k2.klijent_id,
        ROUND(SUM(COALESCE(b.amount, 0)), 2) AS naplaceno
      FROM bank_tx_posting b
      JOIN klijenti k2
        ON (
          LOWER(COALESCE(b.counterparty, '')) LIKE CONCAT('%', LOWER(COALESCE(k2.naziv_klijenta, '')), '%')
          OR LOWER(REPLACE(REPLACE(REPLACE(COALESCE(b.counterparty, ''), '.', ''), ',', ''), ' ', ''))
             LIKE CONCAT('%', LOWER(REPLACE(REPLACE(REPLACE(COALESCE(k2.naziv_klijenta, ''), '.', ''), ',', ''), ' ', '')), '%')
        )
      JOIN (
        SELECT DISTINCT bill_to_klijent_id AS klijent_id
        FROM fakture
        WHERE bill_to_klijent_id IS NOT NULL
          AND DATE(datum_izdavanja) >= ? AND DATE(datum_izdavanja) <= ?
          AND (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN','ZAMIJENJEN'))
      ) inv ON inv.klijent_id = k2.klijent_id
      LEFT JOIN bank_tx_posting_prihod_link l ON l.posting_id = b.posting_id AND l.aktivan = 1
      WHERE b.amount > 0
        AND l.link_id IS NULL
        AND DATE(b.value_date) >= ? AND DATE(b.value_date) <= ?
      GROUP BY k2.klijent_id
    ) bn ON bn.klijent_id = k.klijent_id
    `,
    [from, to, from, to, from, to, from, to, from, to],
  ).catch(() => []);
  return (rows || [])
    .map((r) => ({ partner_id: Number(r.partner_id), saldo: round2(r.saldo) }))
    .filter((r) => Number.isFinite(r.partner_id) && Math.abs(r.saldo) >= 0.01);
}

async function payableBalances(kind, year) {
  const { from, to } = yearRange(year);
  const dt = await trosakDateExpr("t");
  const table = kind === "talent" ? "talent_pocetno_stanje" : "dobavljac_pocetno_stanje";
  const idCol = kind === "talent" ? "talent_id" : "dobavljac_id";
  const tip = kind === "talent" ? "talent" : "dobavljac";
  const isTalent = kind === "talent";

  const rows = await query(
    `
    SELECT m.partner_id,
      COALESCE(ps.pocetno, 0) + COALESCE(w.obaveza, 0) - COALESCE(pa.isplaceno, 0) - COALESCE(pb.isplaceno, 0) AS saldo
    FROM (
      SELECT ${idCol} AS partner_id FROM ${table}
      UNION
      SELECT entity_id AS partner_id FROM projektni_troskovi WHERE ${isTalent ? "entity_type = 'talent'" : "entity_type = 'vendor'"}
      UNION
      SELECT ${isTalent ? "talent_id" : "dobavljac_id"} AS partner_id
      FROM projektni_troskovi
      WHERE ${isTalent ? "talent_id IS NOT NULL" : "dobavljac_id IS NOT NULL"}
    ) m
    LEFT JOIN (
      SELECT p.${idCol} AS partner_id, ROUND(SUM(GREATEST(0, COALESCE(p.iznos_duga,0) - COALESCE(u.paid_km,0))), 2) AS pocetno
      FROM ${table} p
      LEFT JOIN (
        SELECT ref_id, ROUND(SUM(COALESCE(amount_km,0)),2) AS paid_km
        FROM pocetno_stanje_uplate WHERE tip='${tip}' AND aktivan=1
        GROUP BY ref_id
      ) u ON u.ref_id = p.${idCol}
      WHERE COALESCE(p.otpisano,0)=0
      GROUP BY p.${idCol}
    ) ps ON ps.partner_id = m.partner_id
    LEFT JOIN (
      SELECT
        CASE
          WHEN ${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id IS NOT NULL THEN t.entity_id
          WHEN ${isTalent ? "t.talent_id IS NOT NULL" : "t.dobavljac_id IS NOT NULL"} THEN ${isTalent ? "t.talent_id" : "t.dobavljac_id"}
          ELSE NULL
        END AS partner_id,
        ROUND(SUM(COALESCE(t.iznos_km,0)),2) AS obaveza
      FROM projektni_troskovi t
      WHERE (
          (${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id IS NOT NULL)
          OR (${isTalent ? "t.talent_id IS NOT NULL" : "t.dobavljac_id IS NOT NULL"})
        )
        AND t.status <> 'STORNIRANO'
        AND DATE(${dt}) >= ?
        AND DATE(${dt}) <= ?
      GROUP BY partner_id
      HAVING partner_id IS NOT NULL
    ) w ON w.partner_id = m.partner_id
    LEFT JOIN (
      SELECT
        CASE
          WHEN ${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id IS NOT NULL THEN t.entity_id
          WHEN ${isTalent ? "t.talent_id IS NOT NULL" : "t.dobavljac_id IS NOT NULL"} THEN ${isTalent ? "t.talent_id" : "t.dobavljac_id"}
          ELSE NULL
        END AS partner_id,
        ROUND(SUM(COALESCE(ps.iznos_km,0)),2) AS isplaceno
      FROM placanja_stavke ps
      JOIN placanja p ON p.placanje_id = ps.placanje_id
      JOIN projektni_troskovi t ON t.trosak_id = ps.trosak_id
      WHERE (
          (${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id IS NOT NULL)
          OR (${isTalent ? "t.talent_id IS NOT NULL" : "t.dobavljac_id IS NOT NULL"})
        )
        AND COALESCE(LOWER(p.nacin_placanja), '') NOT IN ('keš', 'kes', 'cash', 'blagajna', 'kesh')
        AND DATE(COALESCE(p.datum_placanja, p.created_at)) >= ?
        AND DATE(COALESCE(p.datum_placanja, p.created_at)) <= ?
      GROUP BY partner_id
      HAVING partner_id IS NOT NULL
    ) pa ON pa.partner_id = m.partner_id
    LEFT JOIN (
      SELECT
        b.entity_id AS partner_id,
        ROUND(SUM(COALESCE(b.iznos,0)),2) AS isplaceno
      FROM blagajna_stavke b
      WHERE b.status='AKTIVAN'
        AND b.smjer='OUT'
        AND b.entity_type = '${isTalent ? "talent" : "vendor"}'
        AND b.entity_id IS NOT NULL
        AND DATE(COALESCE(b.datum, b.created_at)) >= ?
        AND DATE(COALESCE(b.datum, b.created_at)) <= ?
      GROUP BY b.entity_id
    ) pb ON pb.partner_id = m.partner_id
    `,
    [from, to, from, to, from, to],
  ).catch(() => []);

  return (rows || [])
    .map((r) => ({ partner_id: Number(r.partner_id), saldo: round2(r.saldo) }))
    .filter((r) => Number.isFinite(r.partner_id) && Math.abs(r.saldo) >= 0.01);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const year = Number(body?.year) || new Date().getFullYear();
    const nextYear = year + 1;

    const [clients, talents, vendors] = await Promise.all([
      clientBalances(year),
      payableBalances("talent", year),
      payableBalances("vendor", year),
    ]);

    await query("START TRANSACTION", []);
    try {
      await query("DELETE FROM pocetno_stanje_uplate", []);
      await query("DELETE FROM klijent_pocetno_stanje", []);
      await query("DELETE FROM talent_pocetno_stanje", []);
      await query("DELETE FROM dobavljac_pocetno_stanje", []);

      for (const r of clients) {
        if (r.saldo <= 0) continue;
        await query(
          `INSERT INTO klijent_pocetno_stanje (klijent_id, iznos_potrazuje, napomena)
           VALUES (?, ?, ?)`,
          [r.partner_id, round2(r.saldo), `Automatski prenos salda za ${nextYear}.`],
        );
      }
      for (const r of talents) {
        if (r.saldo <= 0) continue;
        await query(
          `INSERT INTO talent_pocetno_stanje (talent_id, iznos_duga, napomena)
           VALUES (?, ?, ?)`,
          [r.partner_id, round2(r.saldo), `Automatski prenos salda za ${nextYear}.`],
        );
      }
      for (const r of vendors) {
        if (r.saldo <= 0) continue;
        await query(
          `INSERT INTO dobavljac_pocetno_stanje (dobavljac_id, iznos_duga, napomena)
           VALUES (?, ?, ?)`,
          [r.partner_id, round2(r.saldo), `Automatski prenos salda za ${nextYear}.`],
        );
      }

      await query("COMMIT", []);
    } catch (txErr) {
      await query("ROLLBACK", []).catch(() => {});
      throw txErr;
    }

    return NextResponse.json({
      ok: true,
      year,
      next_year: nextYear,
      carried: {
        klijenti: clients.filter((x) => x.saldo > 0).length,
        saradnici: talents.filter((x) => x.saldo > 0).length,
        dobavljaci: vendors.filter((x) => x.saldo > 0).length,
      },
      note: "Početna stanja su prenesena. Blagajna i projektni promet su uključeni kroz naplate/isplate u kalkulaciji salda.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

