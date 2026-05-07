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
    SELECT COALESCE(p.narucilac_id, p.krajnji_klijent_id) AS klijent_id, ROUND(SUM(COALESCE(pr.iznos_km, 0)), 2) AS s
    FROM projektni_prihodi pr
    JOIN projekti p ON p.projekat_id = pr.projekat_id
    WHERE pr.projekat_id IS NOT NULL
      AND DATE(COALESCE(pr.datum_prihoda, pr.datum)) >= ?
      AND DATE(COALESCE(pr.datum_prihoda, pr.datum)) <= ?
      AND COALESCE(p.narucilac_id, p.krajnji_klijent_id) IS NOT NULL
    GROUP BY COALESCE(p.narucilac_id, p.krajnji_klijent_id)
    `,
    [from, to],
  ).catch(() => []);

  const invoiced = new Map();
  const collected = new Map();
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
    ids.add(id);
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
      const c = round2(collected.get(id) || 0);
      const saldo = round2(p + f - c);
      return {
        partner_id: id,
        partner_naziv: nameMap.get(id) || "—",
        pocetno_stanje: p,
        ukupno_realizovano: f,
        ukupno_placeno: c,
        saldo,
      };
    })
    .filter((x) => Math.abs(x.saldo) >= 0.01)
    .sort((a, b) => a.partner_naziv.localeCompare(b.partner_naziv, "sr"));

  return items;
}

async function getPayableSummary(kind, year) {
  const { from, to } = yearRange(year);
  const opening = await loadOpeningPayableById(kind);
  const entityType = kind === TYPE_TALENT ? "talent" : "vendor";
  const idCol = kind === TYPE_TALENT ? "talent_id" : "dobavljac_id";
  const table = kind === TYPE_TALENT ? "talenti" : "dobavljaci";
  const nameCol = kind === TYPE_TALENT ? "ime_prezime" : "naziv";

  const workedRows = await query(
    `
    SELECT t.entity_id AS partner_id, ROUND(SUM(COALESCE(t.iznos_km, 0)), 2) AS s
    FROM projektni_troskovi t
    WHERE t.entity_type = ?
      AND t.entity_id IS NOT NULL
      AND t.status <> 'STORNIRANO'
      AND DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) >= ?
      AND DATE(COALESCE(t.datum_troska, t.datum_nastanka, t.created_at)) <= ?
    GROUP BY t.entity_id
    `,
    [entityType, from, to],
  ).catch(() => []);

  const paidRows = await query(
    `
    SELECT t.entity_id AS partner_id, ROUND(SUM(COALESCE(ps.iznos_km, 0)), 2) AS s
    FROM placanja_stavke ps
    JOIN placanja p ON p.placanje_id = ps.placanje_id
    JOIN projektni_troskovi t ON t.trosak_id = ps.trosak_id
    WHERE t.entity_type = ?
      AND t.entity_id IS NOT NULL
      AND DATE(COALESCE(p.datum_placanja, p.created_at)) >= ?
      AND DATE(COALESCE(p.datum_placanja, p.created_at)) <= ?
    GROUP BY t.entity_id
    `,
    [entityType, from, to],
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

