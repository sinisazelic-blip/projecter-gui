import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const TYPE_CLIENT = "klijenti";
const TYPE_TALENT = "saradnici";
const TYPE_VENDOR = "dobavljaci";

function yearRange(year) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function iso(d) {
  if (!d) return null;
  const s = String(d);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

async function openingClient(partnerId) {
  const rows = await query(
    `
    SELECT COALESCE(p.iznos_potrazuje, 0) AS iznos, COALESCE(u.paid_km, 0) AS paid_km
    FROM klijent_pocetno_stanje p
    LEFT JOIN (
      SELECT ref_id, ROUND(SUM(COALESCE(amount_km, 0)), 2) AS paid_km
      FROM pocetno_stanje_uplate
      WHERE tip = 'klijent' AND aktivan = 1
      GROUP BY ref_id
    ) u ON u.ref_id = p.klijent_id
    WHERE p.klijent_id = ? AND COALESCE(p.otpisano, 0) = 0
    LIMIT 1
    `,
    [partnerId],
  ).catch(() => []);
  const r = rows?.[0];
  return r ? Math.max(0, round2(Number(r.iznos) - Number(r.paid_km))) : 0;
}

async function openingPayable(kind, partnerId) {
  const table = kind === TYPE_TALENT ? "talent_pocetno_stanje" : "dobavljac_pocetno_stanje";
  const idCol = kind === TYPE_TALENT ? "talent_id" : "dobavljac_id";
  const tip = kind === TYPE_TALENT ? "talent" : "dobavljac";
  const rows = await query(
    `
    SELECT COALESCE(p.iznos_duga, 0) AS iznos, COALESCE(u.paid_km, 0) AS paid_km
    FROM ${table} p
    LEFT JOIN (
      SELECT ref_id, ROUND(SUM(COALESCE(amount_km, 0)), 2) AS paid_km
      FROM pocetno_stanje_uplate
      WHERE tip = '${tip}' AND aktivan = 1
      GROUP BY ref_id
    ) u ON u.ref_id = p.${idCol}
    WHERE p.${idCol} = ? AND COALESCE(p.otpisano, 0) = 0
    LIMIT 1
    `,
    [partnerId],
  ).catch(() => []);
  const r = rows?.[0];
  return r ? Math.max(0, round2(Number(r.iznos) - Number(r.paid_km))) : 0;
}

async function detailClient(partnerId, year) {
  const { from, to } = yearRange(year);
  const opening = await openingClient(partnerId);
  const events = [];

  const fakture = await query(
    `
    SELECT
      DATE(f.datum_izdavanja) AS event_date,
      fp.projekat_id,
      p.radni_naziv AS projekat_naziv,
      COALESCE(f.broj_fakture_puni, CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina)) AS faktura_broj,
      DATE(f.datum_izdavanja) AS datum_fakture,
      ROUND(COALESCE(f.iznos_ukupno_km, 0), 2) AS amount_km
    FROM fakture f
    LEFT JOIN faktura_projekti fp ON fp.faktura_id = f.faktura_id
    LEFT JOIN projekti p ON p.projekat_id = fp.projekat_id
    WHERE f.bill_to_klijent_id = ?
      AND DATE(f.datum_izdavanja) >= ?
      AND DATE(f.datum_izdavanja) <= ?
      AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC
    `,
    [partnerId, from, to],
  ).catch(() => []);

  for (const r of fakture || []) {
    events.push({
      event_date: iso(r.event_date),
      projekat_id: r.projekat_id ? Number(r.projekat_id) : null,
      projekat_naziv: r.projekat_naziv || null,
      faktura_broj: r.faktura_broj || null,
      datum_fakture: iso(r.datum_fakture),
      opis: "Fakturisano",
      duguje: 0,
      potrazuje: round2(r.amount_km),
      nacin_placanja: null,
    });
  }

  const naplate = await query(
    `
    SELECT
      DATE(COALESCE(pr.datum_prihoda, pr.datum)) AS event_date,
      pr.projekat_id,
      p.radni_naziv AS projekat_naziv,
      ROUND(COALESCE(pr.iznos_km, 0), 2) AS amount_km,
      CASE WHEN b.link_id IS NOT NULL THEN 'Banka' ELSE 'Blagajna/ručno' END AS nacin_placanja
    FROM projektni_prihodi pr
    JOIN projekti p ON p.projekat_id = pr.projekat_id
    LEFT JOIN bank_tx_posting_prihod_link b ON b.prihod_id = pr.prihod_id AND b.aktivan = 1
    WHERE COALESCE(p.narucilac_id, p.krajnji_klijent_id) = ?
      AND DATE(COALESCE(pr.datum_prihoda, pr.datum)) >= ?
      AND DATE(COALESCE(pr.datum_prihoda, pr.datum)) <= ?
    ORDER BY DATE(COALESCE(pr.datum_prihoda, pr.datum)) ASC, pr.prihod_id ASC
    `,
    [partnerId, from, to],
  ).catch(() => []);

  for (const r of naplate || []) {
    events.push({
      event_date: iso(r.event_date),
      projekat_id: r.projekat_id ? Number(r.projekat_id) : null,
      projekat_naziv: r.projekat_naziv || null,
      faktura_broj: null,
      datum_fakture: null,
      opis: "Naplata",
      duguje: round2(r.amount_km),
      potrazuje: 0,
      nacin_placanja: r.nacin_placanja || null,
    });
  }

  events.sort((a, b) => String(a.event_date || "").localeCompare(String(b.event_date || "")));

  let running = round2(opening);
  const withSaldo = [
    {
      event_date: `${year}-01-01`,
      projekat_id: null,
      projekat_naziv: null,
      faktura_broj: null,
      datum_fakture: null,
      opis: "Početno stanje",
      duguje: 0,
      potrazuje: 0,
      nacin_placanja: null,
      saldo: running,
    },
  ];

  for (const e of events) {
    running = round2(running + Number(e.potrazuje || 0) - Number(e.duguje || 0));
    withSaldo.push({ ...e, saldo: running });
  }
  return withSaldo;
}

async function detailPayable(kind, partnerId, year) {
  const { from, to } = yearRange(year);
  const opening = await openingPayable(kind, partnerId);
  const entityType = kind === TYPE_TALENT ? "talent" : "vendor";
  const events = [];

  const obaveze = await query(
    `
    SELECT
      DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) AS event_date,
      t.projekat_id,
      p.radni_naziv AS projekat_naziv,
      ROUND(COALESCE(t.iznos_km, 0), 2) AS amount_km
    FROM projektni_troskovi t
    LEFT JOIN projekti p ON p.projekat_id = t.projekat_id
    WHERE t.entity_type = ?
      AND t.entity_id = ?
      AND t.status <> 'STORNIRANO'
      AND DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) >= ?
      AND DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) <= ?
    ORDER BY DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) ASC, t.trosak_id ASC
    `,
    [entityType, partnerId, from, to],
  ).catch(() => []);

  for (const r of obaveze || []) {
    events.push({
      event_date: iso(r.event_date),
      projekat_id: r.projekat_id ? Number(r.projekat_id) : null,
      projekat_naziv: r.projekat_naziv || null,
      faktura_broj: null,
      datum_fakture: null,
      opis: "Obaveza",
      duguje: round2(r.amount_km),
      potrazuje: 0,
      nacin_placanja: null,
    });
  }

  const placanja = await query(
    `
    SELECT
      DATE(COALESCE(p.datum_placanja, p.created_at)) AS event_date,
      t.projekat_id,
      pr.radni_naziv AS projekat_naziv,
      ROUND(COALESCE(ps.iznos_km, 0), 2) AS amount_km,
      p.nacin_placanja
    FROM placanja_stavke ps
    JOIN placanja p ON p.placanje_id = ps.placanje_id
    JOIN projektni_troskovi t ON t.trosak_id = ps.trosak_id
    LEFT JOIN projekti pr ON pr.projekat_id = t.projekat_id
    WHERE t.entity_type = ?
      AND t.entity_id = ?
      AND DATE(COALESCE(p.datum_placanja, p.created_at)) >= ?
      AND DATE(COALESCE(p.datum_placanja, p.created_at)) <= ?
    ORDER BY DATE(COALESCE(p.datum_placanja, p.created_at)) ASC, p.placanje_id ASC
    `,
    [entityType, partnerId, from, to],
  ).catch(() => []);

  for (const r of placanja || []) {
    events.push({
      event_date: iso(r.event_date),
      projekat_id: r.projekat_id ? Number(r.projekat_id) : null,
      projekat_naziv: r.projekat_naziv || null,
      faktura_broj: null,
      datum_fakture: null,
      opis: "Isplata",
      duguje: 0,
      potrazuje: round2(r.amount_km),
      nacin_placanja: r.nacin_placanja || null,
    });
  }

  events.sort((a, b) => String(a.event_date || "").localeCompare(String(b.event_date || "")));

  let running = round2(opening);
  const withSaldo = [
    {
      event_date: `${year}-01-01`,
      projekat_id: null,
      projekat_naziv: null,
      faktura_broj: null,
      datum_fakture: null,
      opis: "Početno stanje",
      duguje: 0,
      potrazuje: 0,
      nacin_placanja: null,
      saldo: running,
    },
  ];
  for (const e of events) {
    running = round2(running + Number(e.duguje || 0) - Number(e.potrazuje || 0));
    withSaldo.push({ ...e, saldo: running });
  }
  return withSaldo;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const partnerId = Number(url.searchParams.get("partner_id"));
    if (![TYPE_CLIENT, TYPE_TALENT, TYPE_VENDOR].includes(type)) {
      return NextResponse.json({ ok: false, error: "Neispravan type." }, { status: 400 });
    }
    if (!Number.isFinite(partnerId) || partnerId <= 0) {
      return NextResponse.json({ ok: false, error: "Neispravan partner_id." }, { status: 400 });
    }

    const events =
      type === TYPE_CLIENT
        ? await detailClient(partnerId, year)
        : await detailPayable(type, partnerId, year);
    return NextResponse.json({ ok: true, type, year, partner_id: partnerId, events });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

