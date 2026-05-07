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

async function loadOpeningClientById() {
  const rows = await query(
    `
    SELECT p.klijent_id, COALESCE(p.iznos_potrazuje, 0) AS iznos, COALESCE(u.paid_km, 0) AS paid_km
    FROM klijent_pocetno_stanje p
    LEFT JOIN (
      SELECT ref_id, ROUND(SUM(COALESCE(amount_km, 0)), 2) AS paid_km
      FROM pocetno_stanje_uplate
      WHERE tip = 'klijent' AND aktivan = 1
      GROUP BY ref_id
    ) u ON u.ref_id = p.klijent_id
    WHERE COALESCE(p.otpisano, 0) = 0
    `,
    [],
  ).catch(() => []);
  const map = new Map();
  for (const r of rows || []) {
    const id = Number(r.klijent_id);
    if (!Number.isFinite(id)) continue;
    map.set(id, Math.max(0, round2(Number(r.iznos) - Number(r.paid_km))));
  }
  return map;
}

async function loadOpeningPayableById(kind) {
  const table = kind === TYPE_TALENT ? "talent_pocetno_stanje" : "dobavljac_pocetno_stanje";
  const idCol = kind === TYPE_TALENT ? "talent_id" : "dobavljac_id";
  const tip = kind === TYPE_TALENT ? "talent" : "dobavljac";
  const rows = await query(
    `
    SELECT p.${idCol} AS partner_id, COALESCE(p.iznos_duga, 0) AS iznos, COALESCE(u.paid_km, 0) AS paid_km
    FROM ${table} p
    LEFT JOIN (
      SELECT ref_id, ROUND(SUM(COALESCE(amount_km, 0)), 2) AS paid_km
      FROM pocetno_stanje_uplate
      WHERE tip = '${tip}' AND aktivan = 1
      GROUP BY ref_id
    ) u ON u.ref_id = p.${idCol}
    WHERE COALESCE(p.otpisano, 0) = 0
    `,
    [],
  ).catch(() => []);
  const map = new Map();
  for (const r of rows || []) {
    const id = Number(r.partner_id);
    if (!Number.isFinite(id)) continue;
    map.set(id, Math.max(0, round2(Number(r.iznos) - Number(r.paid_km))));
  }
  return map;
}

async function getClientSummary(year) {
  const { from, to } = yearRange(year);
  const opening = await loadOpeningClientById();
  const prDt = await prihodDateExpr("pr");

  const invoicedRows = await query(
    `
    SELECT f.bill_to_klijent_id AS klijent_id, ROUND(SUM(COALESCE(f.iznos_ukupno_km, 0)), 2) AS s
    FROM fakture f
    WHERE f.bill_to_klijent_id IS NOT NULL
      AND DATE(f.datum_izdavanja) >= ?
      AND DATE(f.datum_izdavanja) <= ?
      AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    GROUP BY f.bill_to_klijent_id
    `,
    [from, to],
  ).catch(() => []);

  const collectedRows = await query(
    `
    SELECT
      COALESCE(NULLIF(fpr.bill_to_klijent_id, 0), NULLIF(p.narucilac_id, 0), NULLIF(p.krajnji_klijent_id, 0), NULLIF(pc.klijent_id, 0)) AS klijent_id,
      ROUND(SUM(COALESCE(pr.iznos_km, 0)), 2) AS s
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
    WHERE pr.projekat_id IS NOT NULL
      AND DATE(${prDt}) >= ?
      AND DATE(${prDt}) <= ?
      AND COALESCE(NULLIF(fpr.bill_to_klijent_id, 0), NULLIF(p.narucilac_id, 0), NULLIF(p.krajnji_klijent_id, 0), NULLIF(pc.klijent_id, 0)) IS NOT NULL
    GROUP BY COALESCE(NULLIF(fpr.bill_to_klijent_id, 0), NULLIF(p.narucilac_id, 0), NULLIF(p.krajnji_klijent_id, 0), NULLIF(pc.klijent_id, 0))
    `,
    [from, to],
  ).catch(() => []);

  const collectedCashRows = await query(
    `
    SELECT
      COALESCE(
        CASE WHEN LOWER(COALESCE(c.entity_type, '')) IN ('klijent', 'client') THEN NULLIF(c.entity_id, 0) ELSE NULL END,
        NULLIF(p.narucilac_id, 0),
        NULLIF(p.krajnji_klijent_id, 0),
        NULLIF(pc.klijent_id, 0)
      ) AS klijent_id,
      ROUND(SUM(COALESCE(c.iznos, 0)), 2) AS s
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
      ) IS NOT NULL
    GROUP BY COALESCE(
      CASE WHEN LOWER(COALESCE(c.entity_type, '')) IN ('klijent', 'client') THEN NULLIF(c.entity_id, 0) ELSE NULL END,
      NULLIF(p.narucilac_id, 0),
      NULLIF(p.krajnji_klijent_id, 0),
      NULLIF(pc.klijent_id, 0)
    )
    `,
    [from, to],
  ).catch(() => []);

  /** Dominantna valuta po klijentu prema iznosu faktura u godini (za prikaz liste, ne za konverziju). */
  const valutaWeightedRows = await query(
    `
    SELECT
      f.bill_to_klijent_id AS klijent_id,
      COALESCE(NULLIF(TRIM(UPPER(f.valuta)), ''), 'BAM') AS valuta,
      SUM(COALESCE(f.iznos_ukupno_km, 0)) AS w
    FROM fakture f
    WHERE f.bill_to_klijent_id IS NOT NULL
      AND DATE(f.datum_izdavanja) >= ?
      AND DATE(f.datum_izdavanja) <= ?
      AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    GROUP BY f.bill_to_klijent_id, valuta
    `,
    [from, to],
  ).catch(() => []);

  const collectedBankUnmatchedRows = await query(
    `
    SELECT
      k.klijent_id,
      ROUND(SUM(COALESCE(b.amount, 0)), 2) AS s
    FROM bank_tx_posting b
    JOIN klijenti k
      ON (
        LOWER(COALESCE(b.counterparty, '')) LIKE CONCAT('%', LOWER(COALESCE(k.naziv_klijenta, '')), '%')
        OR LOWER(REPLACE(REPLACE(REPLACE(COALESCE(b.counterparty, ''), '.', ''), ',', ''), ' ', ''))
           LIKE CONCAT('%', LOWER(REPLACE(REPLACE(REPLACE(COALESCE(k.naziv_klijenta, ''), '.', ''), ',', ''), ' ', '')), '%')
      )
    JOIN (
      SELECT DISTINCT bill_to_klijent_id AS klijent_id
      FROM fakture
      WHERE bill_to_klijent_id IS NOT NULL
        AND DATE(datum_izdavanja) >= ?
        AND DATE(datum_izdavanja) <= ?
        AND (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    ) inv ON inv.klijent_id = k.klijent_id
    LEFT JOIN bank_tx_posting_prihod_link l ON l.posting_id = b.posting_id AND l.aktivan = 1
    WHERE b.amount > 0
      AND l.link_id IS NULL
      AND DATE(b.value_date) >= ?
      AND DATE(b.value_date) <= ?
    GROUP BY k.klijent_id
    `,
    [from, to, from, to],
  ).catch(() => []);

  const invoiced = new Map();
  const collected = new Map();
  /** Najveći ponder po valuti za prikaz kolone (EUR vs KM) — ista logika kao IOS (brojevi su u jedinicama dokumenta). */
  const prikazValutaByClient = new Map();
  const ids = new Set(opening.keys());

  for (const r of invoicedRows || []) {
    const id = Number(r.klijent_id);
    if (!Number.isFinite(id)) continue;
    invoiced.set(id, round2(r.s));
    ids.add(id);
  }
  for (const r of collectedRows || []) {
    const id = Number(r.klijent_id);
    if (!Number.isFinite(id)) continue;
    collected.set(id, round2(r.s));
  }
  for (const r of collectedCashRows || []) {
    const id = Number(r.klijent_id);
    if (!Number.isFinite(id)) continue;
    const prev = Number(collected.get(id) || 0);
    collected.set(id, round2(prev + Number(r.s || 0)));
  }
  for (const r of collectedBankUnmatchedRows || []) {
    const id = Number(r.klijent_id);
    if (!Number.isFinite(id)) continue;
    const prev = Number(collected.get(id) || 0);
    collected.set(id, round2(prev + Number(r.s || 0)));
  }

  for (const r of valutaWeightedRows || []) {
    const id = Number(r.klijent_id);
    if (!Number.isFinite(id)) continue;
    const v = String(r.valuta || "BAM").trim().toUpperCase() || "BAM";
    const w = Number(r.w || 0);
    const prev = prikazValutaByClient.get(id);
    if (!prev || w > prev.w) prikazValutaByClient.set(id, { valuta: v, w });
  }

  const idList = [...ids].filter((x) => Number.isFinite(x));
  if (!idList.length) return [];
  const placeholders = idList.map(() => "?").join(",");
  const names = await query(
    `SELECT klijent_id AS partner_id, naziv_klijenta AS naziv FROM klijenti WHERE klijent_id IN (${placeholders})`,
    idList,
  ).catch(() => []);
  const nameMap = new Map((names || []).map((r) => [Number(r.partner_id), String(r.naziv || "—")]));

  const items = idList
    .map((id) => {
      const p = round2(opening.get(id) || 0);
      const f = round2(invoiced.get(id) || 0);
      /* Plaćeno kao u IOS detalju (projektni_prihodi + neočitani prilivi), bez „max” prema punom nominalu PLACENA fakture. */
      const c = round2(Number(collected.get(id) || 0));
      const saldo = round2(p + f - c);
      const pv = prikazValutaByClient.get(id);
      return {
        partner_id: id,
        partner_naziv: nameMap.get(id) || "—",
        pocetno_stanje: p,
        ukupno_realizovano: f,
        ukupno_placeno: c,
        saldo,
        prikaz_valuta: pv?.valuta || "BAM",
      };
    })
    .filter((x) => Math.abs(x.saldo) >= 0.01)
    .sort((a, b) => a.partner_naziv.localeCompare(b.partner_naziv, "sr"));

  return items;
}

async function getPayableSummary(kind, year) {
  const { from, to } = yearRange(year);
  const opening = await loadOpeningPayableById(kind);
  const isTalent = kind === TYPE_TALENT;
  const dt = await trosakDateExpr("t");
  const idCol = kind === TYPE_TALENT ? "talent_id" : "dobavljac_id";
  const table = kind === TYPE_TALENT ? "talenti" : "dobavljaci";
  const nameCol = kind === TYPE_TALENT ? "ime_prezime" : "naziv";

  const workedRows = await query(
    `
    SELECT
      CASE
        WHEN ${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id IS NOT NULL THEN t.entity_id
        WHEN ${isTalent ? "t.talent_id IS NOT NULL" : "t.dobavljac_id IS NOT NULL"} THEN ${isTalent ? "t.talent_id" : "t.dobavljac_id"}
        ELSE NULL
      END AS partner_id,
      ROUND(SUM(COALESCE(t.iznos_km, 0)), 2) AS s
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
    `,
    [from, to],
  ).catch(() => []);

  const paidRows = await query(
    `
    SELECT
      CASE
        WHEN ${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id IS NOT NULL THEN t.entity_id
        WHEN ${isTalent ? "t.talent_id IS NOT NULL" : "t.dobavljac_id IS NOT NULL"} THEN ${isTalent ? "t.talent_id" : "t.dobavljac_id"}
        ELSE NULL
      END AS partner_id,
      ROUND(SUM(COALESCE(ps.iznos_km, 0)), 2) AS s
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
    `,
    [from, to],
  ).catch(() => []);

  const paidCashRows = await query(
    `
    SELECT
      b.entity_id AS partner_id,
      ROUND(SUM(COALESCE(b.iznos, 0)), 2) AS s
    FROM blagajna_stavke b
    WHERE b.status = 'AKTIVAN'
      AND b.smjer = 'OUT'
      AND b.entity_type = ?
      AND b.entity_id IS NOT NULL
      AND DATE(COALESCE(b.datum, b.created_at)) >= ?
      AND DATE(COALESCE(b.datum, b.created_at)) <= ?
    GROUP BY b.entity_id
    `,
    [isTalent ? "talent" : "vendor", from, to],
  ).catch(() => []);

  const worked = new Map();
  const paid = new Map();
  const ids = new Set(opening.keys());
  for (const r of workedRows || []) {
    const id = Number(r.partner_id);
    if (!Number.isFinite(id)) continue;
    worked.set(id, round2(r.s));
    ids.add(id);
  }
  for (const r of paidRows || []) {
    const id = Number(r.partner_id);
    if (!Number.isFinite(id)) continue;
    paid.set(id, round2(r.s));
    ids.add(id);
  }
  for (const r of paidCashRows || []) {
    const id = Number(r.partner_id);
    if (!Number.isFinite(id)) continue;
    const prev = Number(paid.get(id) || 0);
    paid.set(id, round2(prev + Number(r.s || 0)));
    ids.add(id);
  }

  const idList = [...ids].filter((x) => Number.isFinite(x));
  if (!idList.length) return [];
  const placeholders = idList.map(() => "?").join(",");
  const names = await query(
    `SELECT ${idCol} AS partner_id, ${nameCol} AS naziv FROM ${table} WHERE ${idCol} IN (${placeholders})`,
    idList,
  ).catch(() => []);
  const nameMap = new Map((names || []).map((r) => [Number(r.partner_id), String(r.naziv || "—")]));

  return idList
    .map((id) => {
      const p = round2(opening.get(id) || 0);
      const w = round2(worked.get(id) || 0);
      const pl = round2(paid.get(id) || 0);
      const saldo = round2(p + w - pl);
      return {
        partner_id: id,
        partner_naziv: nameMap.get(id) || "—",
        pocetno_stanje: p,
        ukupno_realizovano: w,
        ukupno_placeno: pl,
        saldo,
      };
    })
    .filter((x) => Math.abs(x.saldo) >= 0.01)
    .sort((a, b) => a.partner_naziv.localeCompare(b.partner_naziv, "sr"));
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    if (![TYPE_CLIENT, TYPE_TALENT, TYPE_VENDOR].includes(type)) {
      return NextResponse.json({ ok: false, error: "Neispravan type." }, { status: 400 });
    }

    const items =
      type === TYPE_CLIENT
        ? await getClientSummary(year)
        : await getPayableSummary(type, year);

    const summary = items.reduce(
      (acc, it) => {
        acc.pocetno_stanje += it.pocetno_stanje;
        acc.ukupno_realizovano += it.ukupno_realizovano;
        acc.ukupno_placeno += it.ukupno_placeno;
        acc.saldo += it.saldo;
        return acc;
      },
      { pocetno_stanje: 0, ukupno_realizovano: 0, ukupno_placeno: 0, saldo: 0 },
    );

    return NextResponse.json({
      ok: true,
      type,
      year,
      items,
      summary: {
        pocetno_stanje: round2(summary.pocetno_stanje),
        ukupno_realizovano: round2(summary.ukupno_realizovano),
        ukupno_placeno: round2(summary.ukupno_placeno),
        saldo: round2(summary.saldo),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

