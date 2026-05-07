import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function yearRange(year) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

async function clientBalances(year) {
  const { from, to } = yearRange(year);
  const rows = await query(
    `
    SELECT k.klijent_id AS partner_id,
      COALESCE(ps.pocetno, 0) + COALESCE(fi.fakturisano, 0) - COALESCE(na.naplaceno, 0) AS saldo
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
      SELECT COALESCE(p.narucilac_id, p.krajnji_klijent_id) AS klijent_id,
             ROUND(SUM(COALESCE(pr.iznos_km,0)),2) AS naplaceno
      FROM projektni_prihodi pr
      JOIN projekti p ON p.projekat_id = pr.projekat_id
      WHERE DATE(COALESCE(pr.datum_prihoda, pr.datum)) >= ? AND DATE(COALESCE(pr.datum_prihoda, pr.datum)) <= ?
      GROUP BY COALESCE(p.narucilac_id, p.krajnji_klijent_id)
    ) na ON na.klijent_id = k.klijent_id
    `,
    [from, to, from, to],
  ).catch(() => []);
  return (rows || [])
    .map((r) => ({ partner_id: Number(r.partner_id), saldo: round2(r.saldo) }))
    .filter((r) => Number.isFinite(r.partner_id) && Math.abs(r.saldo) >= 0.01);
}

async function payableBalances(kind, year) {
  const { from, to } = yearRange(year);
  const table = kind === "talent" ? "talent_pocetno_stanje" : "dobavljac_pocetno_stanje";
  const idCol = kind === "talent" ? "talent_id" : "dobavljac_id";
  const tip = kind === "talent" ? "talent" : "dobavljac";
  const entityType = kind === "talent" ? "talent" : "vendor";

  const rows = await query(
    `
    SELECT m.partner_id,
      COALESCE(ps.pocetno, 0) + COALESCE(w.obaveza, 0) - COALESCE(pa.isplaceno, 0) AS saldo
    FROM (
      SELECT ${idCol} AS partner_id FROM ${table}
      UNION
      SELECT entity_id AS partner_id FROM projektni_troskovi WHERE entity_type = '${entityType}'
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
      SELECT t.entity_id AS partner_id, ROUND(SUM(COALESCE(t.iznos_km,0)),2) AS obaveza
      FROM projektni_troskovi t
      WHERE t.entity_type = '${entityType}'
        AND t.status <> 'STORNIRANO'
        AND DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) >= ?
        AND DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) <= ?
      GROUP BY t.entity_id
    ) w ON w.partner_id = m.partner_id
    LEFT JOIN (
      SELECT t.entity_id AS partner_id, ROUND(SUM(COALESCE(ps.iznos_km,0)),2) AS isplaceno
      FROM placanja_stavke ps
      JOIN placanja p ON p.placanje_id = ps.placanje_id
      JOIN projektni_troskovi t ON t.trosak_id = ps.trosak_id
      WHERE t.entity_type = '${entityType}'
        AND DATE(COALESCE(p.datum_placanja, p.created_at)) >= ?
        AND DATE(COALESCE(p.datum_placanja, p.created_at)) <= ?
      GROUP BY t.entity_id
    ) pa ON pa.partner_id = m.partner_id
    `,
    [from, to, from, to],
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

