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

/** Sabira naplate uz istu fakturu i isti dan u jedan red (više projekata → jedan iznos kao na fakturi). */
function consolidateNaplateRows(rows) {
  const noFaktura = [];
  const byKey = new Map();
  for (const r of rows || []) {
    const fid = Number(r.faktura_id);
    const ed = iso(r.event_date);
    if (!Number.isFinite(fid) || fid <= 0 || !ed) {
      noFaktura.push(r);
      continue;
    }
    const key = `${fid}\t${ed}\t${String(r.nacin_placanja || "")}`;
    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        event_date: r.event_date,
        faktura_id: r.faktura_id,
        faktura_broj: r.faktura_broj,
        datum_fakture: r.datum_fakture,
        valuta_fakture: r.valuta_fakture,
        nacin_placanja: r.nacin_placanja,
        amount_km: 0,
        projById: new Map(),
      };
      byKey.set(key, acc);
    }
    acc.amount_km = round2(Number(acc.amount_km) + Number(r.amount_km || 0));
    const pid = r.projekat_id != null ? Number(r.projekat_id) : NaN;
    if (Number.isFinite(pid) && pid > 0) {
      const nm = String(r.projekat_naziv || "").trim();
      if (!acc.projById.has(pid)) acc.projById.set(pid, nm);
    }
  }
  const merged = [];
  for (const acc of byKey.values()) {
    let projekat_naziv = null;
    let projekat_id = null;
    if (acc.projById.size === 1) {
      const [[onlyId, onlyName]] = [...acc.projById.entries()];
      projekat_id = onlyId;
      projekat_naziv = onlyName || null;
    } else if (acc.projById.size > 1) {
      projekat_naziv = [...acc.projById.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([id, name]) => `#${id} ${String(name).trim()}`.trim())
        .join("\n");
    }
    merged.push({
      event_date: acc.event_date,
      faktura_id: acc.faktura_id,
      faktura_broj: acc.faktura_broj,
      datum_fakture: acc.datum_fakture,
      projekat_id,
      projekat_naziv,
      amount_km: acc.amount_km,
      valuta_fakture: acc.valuta_fakture,
      nacin_placanja: acc.nacin_placanja,
    });
  }
  return [...merged, ...noFaktura];
}

async function dominantClientInvoiceValuta(partnerId, from, to) {
  const rows = await query(
    `
    SELECT COALESCE(NULLIF(TRIM(UPPER(f.valuta)), ''), 'BAM') AS valuta,
      SUM(COALESCE(f.iznos_ukupno_km, 0)) AS w
    FROM fakture f
    WHERE f.bill_to_klijent_id = ?
      AND DATE(f.datum_izdavanja) >= ?
      AND DATE(f.datum_izdavanja) <= ?
      AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    GROUP BY valuta
    ORDER BY w DESC
    LIMIT 1
    `,
    [partnerId, from, to],
  ).catch(() => []);
  const v = rows?.[0]?.valuta;
  return String(v ?? "BAM")
    .trim()
    .toUpperCase() || "BAM";
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
  const dominantValuta = await dominantClientInvoiceValuta(partnerId, from, to);
  const prDt = await prihodDateExpr("pr");
  const events = [];

  const fakture = await query(
    `
    SELECT
      f.faktura_id,
      DATE(f.datum_izdavanja) AS event_date,
      NULL AS projekat_id,
      (
        SELECT GROUP_CONCAT(
          DISTINCT CONCAT('#', fp2.projekat_id, ' ', COALESCE(p2.radni_naziv, ''))
          ORDER BY fp2.projekat_id
          SEPARATOR '\n'
        )
        FROM faktura_projekti fp2
        LEFT JOIN projekti p2 ON p2.projekat_id = fp2.projekat_id
        WHERE fp2.faktura_id = f.faktura_id
      ) AS projekat_naziv,
      COALESCE(f.broj_fakture_puni, CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina)) AS faktura_broj,
      DATE(f.datum_izdavanja) AS datum_fakture,
      ROUND(COALESCE(f.iznos_ukupno_km, 0), 2) AS amount_km,
      NULLIF(TRIM(UPPER(COALESCE(f.valuta, ''))), '') AS valuta
    FROM fakture f
    WHERE f.bill_to_klijent_id = ?
      AND DATE(f.datum_izdavanja) >= ?
      AND DATE(f.datum_izdavanja) <= ?
      AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC
    `,
    [partnerId, from, to],
  ).catch(() => []);

  for (const r of fakture || []) {
    const valuta = String(r.valuta || "BAM").trim().toUpperCase() || "BAM";
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
      valuta,
    });
  }

  const naplate = await query(
    `
    SELECT
      DATE(${prDt}) AS event_date,
      pr.faktura_id,
      COALESCE(
        NULLIF(TRIM(COALESCE(fpr.broj_fakture_puni, '')), ''),
        CONCAT(LPAD(COALESCE(fpr.broj_u_godini, 0), 3, '0'), '/', COALESCE(fpr.godina, 0))
      ) AS faktura_broj,
      DATE(fpr.datum_izdavanja) AS datum_fakture,
      pr.projekat_id,
      p.radni_naziv AS projekat_naziv,
      ROUND(COALESCE(pr.iznos_km, 0), 2) AS amount_km,
      NULLIF(TRIM(UPPER(COALESCE(fpr.valuta, ''))), '') AS valuta_fakture,
      CASE WHEN b.link_id IS NOT NULL THEN 'Banka' ELSE 'Blagajna/ručno' END AS nacin_placanja
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
        AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
      GROUP BY fp.projekat_id
    ) pc ON pc.projekat_id = pr.projekat_id
    LEFT JOIN bank_tx_posting_prihod_link b ON b.prihod_id = pr.prihod_id AND b.aktivan = 1
    WHERE COALESCE(NULLIF(fpr.bill_to_klijent_id, 0), NULLIF(p.narucilac_id, 0), NULLIF(p.krajnji_klijent_id, 0), NULLIF(pc.klijent_id, 0)) = ?
      AND DATE(${prDt}) >= ?
      AND DATE(${prDt}) <= ?
    ORDER BY DATE(${prDt}) ASC, pr.prihod_id ASC
    `,
    [partnerId, from, to],
  ).catch(() => []);

  const naplateRows = consolidateNaplateRows(naplate || []);

  for (const r of naplateRows) {
    const valuta = String(r.valuta_fakture || "BAM").trim().toUpperCase() || "BAM";
    events.push({
      event_date: iso(r.event_date),
      projekat_id: r.projekat_id ? Number(r.projekat_id) : null,
      projekat_naziv: r.projekat_naziv || null,
      faktura_broj: r.faktura_broj && String(r.faktura_broj).trim() !== "000/0" ? r.faktura_broj : null,
      datum_fakture: iso(r.datum_fakture),
      opis: "Naplata",
      duguje: round2(r.amount_km),
      potrazuje: 0,
      nacin_placanja: r.nacin_placanja || null,
      valuta,
    });
  }

  const cashNaplate = await query(
    `
    SELECT
      DATE(COALESCE(c.datum, c.created_at)) AS event_date,
      c.project_id AS projekat_id,
      p.radni_naziv AS projekat_naziv,
      ROUND(COALESCE(c.iznos, 0), 2) AS amount_km,
      NULLIF(TRIM(UPPER(COALESCE(c.valuta, ''))), '') AS valuta_cash
    FROM blagajna_stavke c
    LEFT JOIN projekti p ON p.projekat_id = c.project_id
    LEFT JOIN (
      SELECT
        fp.projekat_id,
        MIN(f.bill_to_klijent_id) AS klijent_id
      FROM faktura_projekti fp
      JOIN fakture f ON f.faktura_id = fp.faktura_id
      WHERE f.bill_to_klijent_id IS NOT NULL
        AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
      GROUP BY fp.projekat_id
    ) pc ON pc.projekat_id = c.project_id
    WHERE c.smjer = 'IN'
      AND COALESCE(c.status, 'AKTIVAN') = 'AKTIVAN'
      AND DATE(COALESCE(c.datum, c.created_at)) >= ?
      AND DATE(COALESCE(c.datum, c.created_at)) <= ?
      AND COALESCE(
        CASE WHEN LOWER(COALESCE(c.entity_type, '')) IN ('klijent', 'client') THEN NULLIF(c.entity_id, 0) ELSE NULL END,
        NULLIF(p.narucilac_id, 0),
        NULLIF(p.krajnji_klijent_id, 0),
        NULLIF(pc.klijent_id, 0)
      ) = ?
    ORDER BY DATE(COALESCE(c.datum, c.created_at)) ASC, c.id ASC
    `,
    [from, to, partnerId],
  ).catch(() => []);

  for (const r of cashNaplate || []) {
    const valuta = String(r.valuta_cash || dominantValuta || "BAM").trim().toUpperCase() || "BAM";
    events.push({
      event_date: iso(r.event_date),
      projekat_id: r.projekat_id ? Number(r.projekat_id) : null,
      projekat_naziv: r.projekat_naziv || null,
      faktura_broj: null,
      datum_fakture: null,
      opis: "Naplata (blagajna)",
      duguje: round2(r.amount_km),
      potrazuje: 0,
      nacin_placanja: "Blagajna",
      valuta,
    });
  }

  const invYear = await query(
    `
    SELECT COUNT(*) AS c
    FROM fakture
    WHERE bill_to_klijent_id = ?
      AND DATE(datum_izdavanja) >= ?
      AND DATE(datum_izdavanja) <= ?
      AND (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    `,
    [partnerId, from, to],
  ).catch(() => [{ c: 0 }]);
  const hasInvoiceThisYear = Number(invYear?.[0]?.c || 0) > 0;

  if (hasInvoiceThisYear) {
    const bankUnmatched = await query(
      `
      SELECT
        DATE(b.value_date) AS event_date,
        ROUND(COALESCE(b.amount, 0), 2) AS amount_km,
        NULLIF(TRIM(UPPER(COALESCE(b.currency, ''))), '') AS valuta_postinga
      FROM bank_tx_posting b
      JOIN klijenti k ON k.klijent_id = ?
      LEFT JOIN bank_tx_posting_prihod_link l ON l.posting_id = b.posting_id AND l.aktivan = 1
      WHERE b.amount > 0
        AND l.link_id IS NULL
        AND DATE(b.value_date) >= ?
        AND DATE(b.value_date) <= ?
        AND (
          LOWER(COALESCE(b.counterparty, '')) LIKE CONCAT('%', LOWER(COALESCE(k.naziv_klijenta, '')), '%')
          OR LOWER(REPLACE(REPLACE(REPLACE(COALESCE(b.counterparty, ''), '.', ''), ',', ''), ' ', ''))
             LIKE CONCAT('%', LOWER(REPLACE(REPLACE(REPLACE(COALESCE(k.naziv_klijenta, ''), '.', ''), ',', ''), ' ', '')), '%')
        )
      ORDER BY DATE(b.value_date) ASC, b.posting_id ASC
      `,
      [partnerId, from, to],
    ).catch(() => []);

    for (const r of bankUnmatched || []) {
      const valuta = String(r.valuta_postinga || "BAM").trim().toUpperCase() || "BAM";
      events.push({
        event_date: iso(r.event_date),
        projekat_id: null,
        projekat_naziv: null,
        faktura_broj: null,
        datum_fakture: null,
        opis: "Naplata (izvod - neidentifikovano)",
        duguje: round2(r.amount_km),
        potrazuje: 0,
        nacin_placanja: "Banka",
        valuta,
      });
    }
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
      valuta: dominantValuta,
      saldo: running,
    },
  ];

  for (const e of events) {
    running = round2(running + Number(e.potrazuje || 0) - Number(e.duguje || 0));
    const valuta = String(e.valuta || "BAM").trim().toUpperCase() || "BAM";
    withSaldo.push({ ...e, valuta, saldo: running });
  }
  return withSaldo;
}

async function detailPayable(kind, partnerId, year) {
  const { from, to } = yearRange(year);
  const opening = await openingPayable(kind, partnerId);
  const isTalent = kind === TYPE_TALENT;
  const dt = await trosakDateExpr("t");
  const events = [];

  const obaveze = await query(
    `
    SELECT
      DATE(${dt}) AS event_date,
      t.projekat_id,
      p.radni_naziv AS projekat_naziv,
      ROUND(COALESCE(t.iznos_km, 0), 2) AS amount_km
    FROM projektni_troskovi t
    LEFT JOIN projekti p ON p.projekat_id = t.projekat_id
    WHERE (
        (${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id = ?)
        OR (${isTalent ? "t.talent_id = ?" : "t.dobavljac_id = ?"})
      )
      AND t.status <> 'STORNIRANO'
      AND DATE(${dt}) >= ?
      AND DATE(${dt}) <= ?
    ORDER BY DATE(${dt}) ASC, t.trosak_id ASC
    `,
    [partnerId, partnerId, from, to],
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
    WHERE (
        (${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id = ?)
        OR (${isTalent ? "t.talent_id = ?" : "t.dobavljac_id = ?"})
      )
      AND COALESCE(LOWER(p.nacin_placanja), '') NOT IN ('keš', 'kes', 'cash', 'blagajna', 'kesh')
      AND DATE(COALESCE(p.datum_placanja, p.created_at)) >= ?
      AND DATE(COALESCE(p.datum_placanja, p.created_at)) <= ?
    ORDER BY DATE(COALESCE(p.datum_placanja, p.created_at)) ASC, p.placanje_id ASC
    `,
    [partnerId, partnerId, from, to],
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

  const blagajna = await query(
    `
    SELECT
      DATE(COALESCE(b.datum, b.created_at)) AS event_date,
      NULL AS projekat_id,
      NULL AS projekat_naziv,
      ROUND(COALESCE(b.iznos, 0), 2) AS amount_km
    FROM blagajna_stavke b
    WHERE b.status = 'AKTIVAN'
      AND b.smjer = 'OUT'
      AND b.entity_type = ?
      AND b.entity_id = ?
      AND DATE(COALESCE(b.datum, b.created_at)) >= ?
      AND DATE(COALESCE(b.datum, b.created_at)) <= ?
    ORDER BY DATE(COALESCE(b.datum, b.created_at)) ASC, b.id ASC
    `,
    [isTalent ? "talent" : "vendor", partnerId, from, to],
  ).catch(() => []);

  for (const r of blagajna || []) {
    events.push({
      event_date: iso(r.event_date),
      projekat_id: null,
      projekat_naziv: null,
      faktura_broj: null,
      datum_fakture: null,
      opis: "Isplata (blagajna)",
      duguje: 0,
      potrazuje: round2(r.amount_km),
      nacin_placanja: "Blagajna",
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

