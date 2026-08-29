// Obračun PDV za prijavu: izlazni (KIF) − ulazni (KUF) = za prijavu. Liste dokumenata.
import { query } from "@/lib/db";
import { isFakturaPlacenaStatus } from "@/lib/invoicePaidStatus";
import { includeStudioArchive } from "@/lib/reports/archive";

const LIST_LIMIT = 5000;

async function kufHasPdvColumn() {
  try {
    const rows = await query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kuf_ulazne_fakture' AND COLUMN_NAME = 'pdv_iznos_km'
       LIMIT 1`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function kufHasColumn(column) {
  try {
    const rows = await query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kuf_ulazne_fakture' AND COLUMN_NAME = ?
       LIMIT 1`,
      [column],
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}
const ARHIVA_CUTOFF = "2025-12-31";

/** Vraća datum kao YYYY-MM-DD (iz Date objekta ili stringa). */
function toIsoDate(val) {
  if (val == null) return null;
  const s = typeof val === "string" ? val.trim() : null;
  if (s && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getLastMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Rok predaje: 10. u mjesecu nakon kraja perioda (YYYY-MM-DD). */
export function getPdvRokPredaje(periodTo) {
  const iso = toIsoDate(periodTo);
  if (!iso) return null;
  const [y, m] = iso.split("-").map(Number);
  const rok = new Date(y, m, 10); // m je 1-based iz split, Date mjesec je 0-based → m = sljedeći mjesec
  const yy = rok.getFullYear();
  const mm = String(rok.getMonth() + 1).padStart(2, "0");
  const dd = String(rok.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function isPdvRegisteredClient(pib) {
  return String(pib ?? "").replace(/\D/g, "").length === 12;
}

/**
 * Polja obrasca P PDV iz KIF/KUF redova (iznosi bez PDV-a gdje obrazac traži).
 * f32/f33/f34: PDV na isporuke neregistrovanim obveznicima — heuristika bez PIB-a → RS (33).
 */
export function buildPdvObrazacFields(kifRows, kufRows, periodTo) {
  let f11 = 0;
  let f12 = 0;
  let f13 = 0;
  let f51 = 0;
  let f32 = 0;
  let f33 = 0;
  let f34 = 0;

  for (const r of kifRows || []) {
    const osn = Number(r.osnovica_km) || 0;
    const pdv = Number(r.pdv_km) || 0;
    if (Math.abs(pdv) < 0.005) {
      f13 += osn;
    } else {
      f11 += osn;
      f51 += pdv;
      // Krajnja potrošnja: nema PIB = nije registrovani PDV obveznik (pretpostavka RS).
      if (!r.iz_arhive && !isPdvRegisteredClient(r.kupac_pib)) {
        f33 += pdv;
      }
    }
  }

  let f21 = 0;
  let f22 = 0;
  let f23 = 0;
  let f41 = 0;
  let f42 = 0;
  let f43 = 0;

  for (const r of kufRows || []) {
    f21 += Number(r.osnovica_km) || 0;
    f41 += Number(r.pdv_km) || 0;
  }

  f11 = round2(f11);
  f12 = round2(f12);
  f13 = round2(f13);
  f21 = round2(f21);
  f22 = round2(f22);
  f23 = round2(f23);
  f41 = round2(f41);
  f42 = round2(f42);
  f43 = round2(f43);
  f51 = round2(f51);
  const f61 = round2(f41 + f42 + f43);
  const f71 = round2(f51 - f61);
  f32 = round2(f32);
  f33 = round2(f33);
  f34 = round2(f34);

  return {
    f11,
    f12,
    f13,
    f21,
    f22,
    f23,
    f41,
    f42,
    f43,
    f51,
    f61,
    f71,
    f32,
    f33,
    f34,
    /** Zahtjev za povrat (80) ne označavamo automatski — pretplata se često prenosi. */
    f80_povrat: false,
    rok_predaje: getPdvRokPredaje(periodTo),
  };
}

async function getActiveFirmaForPdv() {
  try {
    const rows = await query(
      `SELECT firma_id, naziv, pravni_naziv, adresa, grad, drzava, jib, pib, pdv_broj
       FROM firma_profile
       WHERE is_active = 1
       ORDER BY firma_id DESC
       LIMIT 1`,
    );
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

export async function getPdvPrijavaData(from, to, opts = {}) {
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) from = null;
  if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) to = null;
  const range = getLastMonthRange();
  from = from || range.from;
  to = to || range.to;
  const excludePaidKif = Boolean(opts?.excludePaidKif);

  const whereF = [
    "(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))",
  ];
  const paramsF = [from, to];
  whereF.push("f.datum_izdavanja >= ?", "f.datum_izdavanja <= ?");

  let kifRows = [];
  try {
    kifRows = await query(
      `SELECT f.faktura_id, f.broj_fakture_puni AS broj_fakture, f.datum_izdavanja,
              f.osnovica_km, f.pdv_iznos_km AS pdv_iznos, f.iznos_ukupno_km,
              f.fiskalni_status,
              c.naziv_klijenta AS kupac,
              c.pib AS kupac_pib,
              c.jib AS kupac_jib
       FROM fakture f
       LEFT JOIN klijenti c ON c.klijent_id = f.bill_to_klijent_id
       WHERE ${whereF.join(" AND ")}
       ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC
       LIMIT ${LIST_LIMIT}`,
      paramsF,
    );
  } catch {
    try {
      kifRows = await query(
        `SELECT f.faktura_id, f.broj_fakture_puni AS broj_fakture, f.datum_izdavanja,
                f.osnovica_km, f.pdv_iznos_km AS pdv_iznos, f.iznos_ukupno_km,
                f.fiskalni_status,
                c.naziv_klijenta AS kupac,
                NULL AS kupac_pib,
                NULL AS kupac_jib
         FROM fakture f
         LEFT JOIN klijenti c ON c.klijent_id = f.bill_to_klijent_id
         WHERE ${whereF.join(" AND ")}
         ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC
         LIMIT ${LIST_LIMIT}`,
        paramsF,
      );
    } catch {
      kifRows = [];
    }
  }

  const kif = (kifRows || []).map((r) => ({
    tip: "KIF",
    id: r.faktura_id,
    broj: r.broj_fakture ?? `#${r.faktura_id}`,
    datum: toIsoDate(r.datum_izdavanja),
    kupac: r.kupac ?? "—",
    kupac_pib: r.kupac_pib ?? null,
    kupac_jib: r.kupac_jib ?? null,
    osnovica_km: Number(r.osnovica_km) || 0,
    pdv_km: Number(r.pdv_iznos) || 0,
    ukupno_km: Number(r.iznos_ukupno_km) || 0,
    fiskalni_status: r.fiskalni_status ?? null,
    iz_arhive: false,
  }));

  if (includeStudioArchive()) try {
    const archRows = await query(
      `SELECT broj_fakture, MAX(datum_fakture) AS datum_fakture,
              ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km,
              ROUND(SUM(COALESCE(iznos_ukupno_km, iznos_sa_pdv_km, iznos_km)), 2) AS ukupno_faktura
       FROM stg_master_finansije
       WHERE datum_fakture IS NOT NULL AND datum_fakture <= ?
         AND datum_fakture >= ? AND datum_fakture <= ?
       GROUP BY broj_fakture
       ORDER BY datum_fakture ASC, broj_fakture ASC
       LIMIT ${LIST_LIMIT}`,
      [ARHIVA_CUTOFF, from, to],
    );
    for (const r of archRows || []) {
      const osn = Number(r.iznos_km) || 0;
      const uk = Number(r.ukupno_faktura ?? r.iznos_km) || osn;
      const pdv = Math.max(0, uk - osn);
      kif.push({
        tip: "KIF",
        id: null,
        broj: r.broj_fakture ?? "—",
        datum: toIsoDate(r.datum_fakture),
        kupac: "(arhiva)",
        osnovica_km: osn,
        pdv_km: pdv,
        ukupno_km: uk,
        fiskalni_status: null,
        iz_arhive: true,
      });
    }
  } catch {
    // no archive
  }
  kif.sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));

  const pdv_izlazni_ukupno = kif.reduce((s, i) => s + i.pdv_km, 0);

  const kifDisplay = excludePaidKif
    ? kif.filter(
        (row) => row.iz_arhive || !isFakturaPlacenaStatus(row.fiskalni_status),
      )
    : kif;

  let kufRows = [];
  const kufPdvCol = await kufHasPdvColumn();
  try {
    const pdvSel = kufPdvCol ? "k.pdv_iznos_km," : "NULL AS pdv_iznos_km,";
    const hasDatumPrijema = await kufHasColumn("datum_prijema");
    const hasCreatedAt = await kufHasColumn("created_at");
    const periodDateExpr = hasDatumPrijema
      ? "COALESCE(k.datum_prijema, k.datum_fakture)"
      : hasCreatedAt
        ? "COALESCE(DATE(k.created_at), k.datum_fakture)"
        : "k.datum_fakture";
    kufRows = await query(
      `SELECT k.kuf_id, k.broj_fakture, k.datum_fakture, k.iznos_km, ${pdvSel}
              k.partner_naziv,
              d.naziv AS dobavljac_naziv, kl.naziv_klijenta AS klijent_naziv
       FROM kuf_ulazne_fakture k
       LEFT JOIN dobavljaci d ON d.dobavljac_id = k.dobavljac_id
       LEFT JOIN klijenti kl ON kl.klijent_id = k.klijent_id
       WHERE ${periodDateExpr} >= ? AND ${periodDateExpr} <= ?
         AND (k.status IS NULL OR k.status NOT IN ('STORNO'))
       ORDER BY ${periodDateExpr} ASC, k.kuf_id ASC
       LIMIT ${LIST_LIMIT}`,
      [from, to],
    );
  } catch {
    kufRows = [];
  }

  const kuf = (kufRows || []).map((r) => {
    const ukupno = Number(r.iznos_km) || 0;
    const pdvUlazni = Math.round(Number(r.pdv_iznos_km ?? 0) * 100) / 100;
    const osnovica = Math.round((ukupno - pdvUlazni) * 100) / 100;
    const partner =
      r.dobavljac_naziv || r.klijent_naziv || r.partner_naziv || "—";
    return {
      tip: "KUF",
      id: r.kuf_id,
      broj: r.broj_fakture ?? `KUF#${r.kuf_id}`,
      datum: toIsoDate(r.datum_fakture),
      partner,
      osnovica_km: osnovica,
      pdv_km: pdvUlazni,
      ukupno_km: ukupno,
    };
  });

  const pdv_ulazni_ukupno = kuf.reduce((s, i) => s + i.pdv_km, 0);
  const za_prijavu =
    Math.round((pdv_izlazni_ukupno - pdv_ulazni_ukupno) * 100) / 100;

  // Obrazac uvijek iz kompletnog KIF-a (ne filtriranog po plaćenim).
  const obrazac = buildPdvObrazacFields(kif, kuf, to);
  const firma = await getActiveFirmaForPdv();
  const credit = await getPdvCreditForPeriod(from, to);

  return {
    from,
    to,
    summary: {
      pdv_izlazni_km: Math.round(pdv_izlazni_ukupno * 100) / 100,
      pdv_ulazni_km: Math.round(pdv_ulazni_ukupno * 100) / 100,
      za_prijavu_km: za_prijavu,
    },
    credit,
    kif: kifDisplay,
    kif_filter_exclude_paid: excludePaidKif,
    kuf,
    obrazac,
    firma,
  };
}

function monthRange(year, month1to12) {
  const y = Number(year);
  const m = Number(month1to12);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/** Da li je period tačno jedan kalendarski mjesec. */
export function isFullCalendarMonth(from, to) {
  if (!from || !to) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return false;
  }
  const [y, m, d] = from.split("-").map(Number);
  if (d !== 1) return false;
  const lastDay = new Date(y, m, 0).getDate();
  const expectedTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return to === expectedTo;
}

/**
 * Lanac pretplate: negativan saldo mjeseca prenosi se u sljedeći.
 * openingCredit = pretplata na početku prvog mjeseca u listi.
 */
export function applyPdvCreditChain(months, openingCredit = 0) {
  let credit = round2(openingCredit);
  return (months || []).map((row) => {
    const saldo = round2(row.za_prijavu_km ?? row.saldo_mjeseca_km ?? 0);
    const preneto_km = credit;
    const after = round2(saldo - preneto_km);
    const za_uplatu_km = after >= 0 ? after : 0;
    const pretplata_km = after < 0 ? round2(-after) : 0;
    credit = pretplata_km;
    return {
      ...row,
      saldo_mjeseca_km: saldo,
      preneto_km,
      za_uplatu_km,
      pretplata_km,
    };
  });
}

/**
 * Pregled PDV prijava po mjesecima u kalendarskoj (fiskalnoj) godini.
 * @param {{ skipPriorYear?: boolean }} opts — skipPriorYear izbjegava rekurziju za prenos iz prethodne godine.
 */
export async function getPdvYearOverview(year, opts = {}) {
  const y = Number(year);
  const safeYear =
    Number.isFinite(y) && y >= 2000 && y <= 2100
      ? Math.trunc(y)
      : new Date().getFullYear();
  const yearFrom = `${safeYear}-01-01`;
  const yearTo = `${safeYear}-12-31`;

  const izlazniByMonth = new Map();
  const ulazniByMonth = new Map();

  try {
    const rows = await query(
      `SELECT MONTH(f.datum_izdavanja) AS m,
              ROUND(SUM(COALESCE(f.pdv_iznos_km, 0)), 2) AS pdv_izlazni
       FROM fakture f
       WHERE f.datum_izdavanja >= ? AND f.datum_izdavanja <= ?
         AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
       GROUP BY MONTH(f.datum_izdavanja)`,
      [yearFrom, yearTo],
    );
    for (const r of rows || []) {
      izlazniByMonth.set(
        Number(r.m),
        round2((izlazniByMonth.get(Number(r.m)) || 0) + (Number(r.pdv_izlazni) || 0)),
      );
    }
  } catch {
    // ignore
  }

  if (includeStudioArchive()) try {
    const archRows = await query(
      `SELECT MONTH(t.datum_fakture) AS m,
              ROUND(SUM(t.pdv_izlazni), 2) AS pdv_izlazni
       FROM (
         SELECT broj_fakture,
                MAX(datum_fakture) AS datum_fakture,
                GREATEST(0,
                  ROUND(SUM(COALESCE(iznos_ukupno_km, iznos_sa_pdv_km, iznos_km)), 2)
                  - ROUND(SUM(COALESCE(iznos_km, 0)), 2)
                ) AS pdv_izlazni
         FROM stg_master_finansije
         WHERE datum_fakture IS NOT NULL
           AND datum_fakture <= ?
           AND datum_fakture >= ? AND datum_fakture <= ?
         GROUP BY broj_fakture
       ) t
       GROUP BY MONTH(t.datum_fakture)`,
      [ARHIVA_CUTOFF, yearFrom, yearTo],
    );
    for (const r of archRows || []) {
      const m = Number(r.m);
      izlazniByMonth.set(
        m,
        round2((izlazniByMonth.get(m) || 0) + (Number(r.pdv_izlazni) || 0)),
      );
    }
  } catch {
    // arhiva nedostupna ili bez kolona za ukupno
  }

  try {
    const kufPdvCol = await kufHasPdvColumn();
    const pdvExpr = kufPdvCol ? "COALESCE(k.pdv_iznos_km, 0)" : "0";
    const hasDatumPrijema = await kufHasColumn("datum_prijema");
    const hasCreatedAt = await kufHasColumn("created_at");
    const periodDateExpr = hasDatumPrijema
      ? "COALESCE(k.datum_prijema, k.datum_fakture)"
      : hasCreatedAt
        ? "COALESCE(DATE(k.created_at), k.datum_fakture)"
        : "k.datum_fakture";
    const rows = await query(
      `SELECT MONTH(${periodDateExpr}) AS m,
              ROUND(SUM(${pdvExpr}), 2) AS pdv_ulazni
       FROM kuf_ulazne_fakture k
       WHERE ${periodDateExpr} >= ? AND ${periodDateExpr} <= ?
         AND (k.status IS NULL OR k.status NOT IN ('STORNO'))
       GROUP BY MONTH(${periodDateExpr})`,
      [yearFrom, yearTo],
    );
    for (const r of rows || []) {
      ulazniByMonth.set(Number(r.m), round2(Number(r.pdv_ulazni) || 0));
    }
  } catch {
    // ignore
  }

  let openingCredit = 0;
  if (!opts.skipPriorYear && safeYear > 2000) {
    try {
      const prev = await getPdvYearOverview(safeYear - 1, { skipPriorYear: true });
      openingCredit = round2(prev.months?.[11]?.pretplata_km || 0);
    } catch {
      openingCredit = 0;
    }
  }

  const rawMonths = [];
  for (let m = 1; m <= 12; m++) {
    const { from, to } = monthRange(safeYear, m);
    const pdv_izlazni_km = round2(izlazniByMonth.get(m) || 0);
    const pdv_ulazni_km = round2(ulazniByMonth.get(m) || 0);
    const za_prijavu_km = round2(pdv_izlazni_km - pdv_ulazni_km);
    rawMonths.push({
      year: safeYear,
      month: m,
      from,
      to,
      pdv_izlazni_km,
      pdv_ulazni_km,
      za_prijavu_km,
      rok_predaje: getPdvRokPredaje(to),
      has_activity:
        Math.abs(pdv_izlazni_km) > 0.004 || Math.abs(pdv_ulazni_km) > 0.004,
    });
  }

  const months = applyPdvCreditChain(rawMonths, openingCredit);

  const totals = months.reduce(
    (acc, row) => {
      acc.pdv_izlazni_km = round2(acc.pdv_izlazni_km + row.pdv_izlazni_km);
      acc.pdv_ulazni_km = round2(acc.pdv_ulazni_km + row.pdv_ulazni_km);
      acc.saldo_mjeseci_km = round2(acc.saldo_mjeseci_km + row.saldo_mjeseca_km);
      acc.za_uplatu_km = round2(acc.za_uplatu_km + row.za_uplatu_km);
      return acc;
    },
    {
      pdv_izlazni_km: 0,
      pdv_ulazni_km: 0,
      saldo_mjeseci_km: 0,
      za_uplatu_km: 0,
    },
  );
  totals.pretplata_kraj_km = round2(months[11]?.pretplata_km || 0);
  totals.preneto_godina_km = round2(openingCredit);

  return { year: safeYear, months, totals, opening_credit_km: openingCredit };
}

/**
 * Prenos pretplate i neto obaveza za period (ako je pun kalendarski mjesec).
 */
export async function getPdvCreditForPeriod(from, to) {
  if (!isFullCalendarMonth(from, to)) {
    return {
      is_full_month: false,
      preneto_km: 0,
      saldo_mjeseca_km: null,
      za_uplatu_km: null,
      pretplata_km: null,
    };
  }
  const year = Number(String(from).slice(0, 4));
  const month = Number(String(from).slice(5, 7));
  const overview = await getPdvYearOverview(year);
  const row = overview.months.find((m) => m.month === month);
  if (!row) {
    return {
      is_full_month: true,
      preneto_km: 0,
      saldo_mjeseca_km: 0,
      za_uplatu_km: 0,
      pretplata_km: 0,
    };
  }
  return {
    is_full_month: true,
    preneto_km: row.preneto_km,
    saldo_mjeseca_km: row.saldo_mjeseca_km,
    za_uplatu_km: row.za_uplatu_km,
    pretplata_km: row.pretplata_km,
  };
}
