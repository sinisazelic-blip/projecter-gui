import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const AUTO_TAG = "[AUTO_BANK_OTPIS]";
const DEFAULT_MAX_GAP = Number(process.env.BANK_WRITE_OFF_MAX_PER_INVOICE || 25);

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function isoDate(val) {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function normStatus(s) {
  return String(s || "").trim().toUpperCase();
}

async function getInvoiceById(fakturaId) {
  const rows = await query(
    `SELECT f.faktura_id,
            f.bill_to_klijent_id AS partner_id,
            ROUND(COALESCE(f.iznos_ukupno_km, 0), 2) AS total_km,
            DATE(f.datum_izdavanja) AS datum_izdavanja,
            COALESCE(f.broj_fakture_puni, CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina)) AS faktura_broj,
            TRIM(UPPER(COALESCE(f.fiskalni_status, ''))) AS fiskalni_status
     FROM fakture f
     WHERE f.faktura_id = ?
       AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
     LIMIT 1`,
    [fakturaId],
  );
  return rows?.[0] || null;
}

async function linkedIncomeByInvoice(fakturaId) {
  const rows = await query(
    `SELECT ROUND(COALESCE(SUM(COALESCE(pr.iznos_km, 0)), 0), 2) AS s
     FROM projektni_prihodi pr
     WHERE pr.faktura_id = ?`,
    [fakturaId],
  );
  return round2(rows?.[0]?.s || 0);
}

async function invoiceProjects(fakturaId) {
  const rows = await query(
    `SELECT projekat_id FROM faktura_projekti WHERE faktura_id = ? ORDER BY projekat_id ASC`,
    [fakturaId],
  );
  return (rows || [])
    .map((r) => Number(r.projekat_id))
    .filter((x) => Number.isFinite(x) && x > 0);
}

async function applyWriteoffToInvoice(fakturaId, opts = {}) {
  const invoice = await getInvoiceById(fakturaId);
  if (!invoice) return { ok: false, error: "INVOICE_NOT_FOUND" };

  const total = round2(invoice.total_km);
  const linked = await linkedIncomeByInvoice(fakturaId);
  const missing = round2(total - linked);
  if (missing <= 0.01) {
    return { ok: true, faktura_id: fakturaId, faktura_broj: invoice.faktura_broj, applied_km: 0, reason: "NO_GAP" };
  }

  const maxGap = Number(opts.maxGap);
  if (Number.isFinite(maxGap) && maxGap > 0 && missing > maxGap) {
    return {
      ok: true,
      faktura_id: fakturaId,
      faktura_broj: invoice.faktura_broj,
      applied_km: 0,
      reason: "GAP_ABOVE_LIMIT",
      gap_km: missing,
      limit_km: maxGap,
    };
  }

  const projects = await invoiceProjects(fakturaId);
  if (!projects.length) return { ok: false, error: "INVOICE_HAS_NO_PROJECTS", faktura_id: fakturaId };

  const datum = isoDate(invoice.datum_izdavanja) || new Date().toISOString().slice(0, 10);
  const opis = `Otpis bankarske razlike (${invoice.faktura_broj || `#${fakturaId}`})`;

  const per = Math.floor((missing / projects.length) * 100) / 100;
  let remainder = round2(missing - per * projects.length);
  const prihodIds = [];
  for (let i = 0; i < projects.length; i++) {
    const extra = remainder > 0 ? 0.01 : 0;
    if (remainder > 0) remainder = round2(remainder - 0.01);
    const part = round2(per + extra);
    if (part <= 0) continue;
    const ins = await query(
      `INSERT INTO projektni_prihodi
         (projekat_id, faktura_id, datum_prihoda, iznos_km, opis)
       VALUES
         (?, ?, ?, ?, ?)`,
      [projects[i], fakturaId, datum, part, opis],
    );
    const pid = ins?.insertId ?? ins?.rows?.insertId;
    if (pid) prihodIds.push(pid);
  }

  await query(`UPDATE fakture SET fiskalni_status = 'PLACENA' WHERE faktura_id = ?`, [fakturaId]).catch(() => {});

  return {
    ok: true,
    faktura_id: fakturaId,
    faktura_broj: invoice.faktura_broj,
    applied_km: missing,
    prihod_ids: prihodIds,
  };
}

async function isAutoEnabled(partnerId) {
  const rows = await query(`SELECT COALESCE(napomena, '') AS napomena FROM klijenti WHERE klijent_id = ? LIMIT 1`, [partnerId]);
  const note = String(rows?.[0]?.napomena || "");
  return note.includes(AUTO_TAG);
}

async function setAutoEnabled(partnerId, enabled) {
  const rows = await query(`SELECT COALESCE(napomena, '') AS napomena FROM klijenti WHERE klijent_id = ? LIMIT 1`, [partnerId]);
  const current = String(rows?.[0]?.napomena || "");
  const hasTag = current.includes(AUTO_TAG);
  let next = current;
  if (enabled && !hasTag) next = `${current}${current.trim() ? " " : ""}${AUTO_TAG}`.trim();
  if (!enabled && hasTag) next = current.replace(AUTO_TAG, "").replace(/\s{2,}/g, " ").trim();
  await query(`UPDATE klijenti SET napomena = ?, updated_at = NOW() WHERE klijent_id = ?`, [next || null, partnerId]);
  return { enabled: !!enabled };
}

async function applyForClientYear(partnerId, year, maxGap = DEFAULT_MAX_GAP) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const invoices = await query(
    `SELECT f.faktura_id, TRIM(UPPER(COALESCE(f.fiskalni_status, ''))) AS fiskalni_status
     FROM fakture f
     WHERE f.bill_to_klijent_id = ?
       AND DATE(f.datum_izdavanja) >= ?
       AND DATE(f.datum_izdavanja) <= ?
       AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
     ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC`,
    [partnerId, from, to],
  );

  const results = [];
  for (const inv of invoices || []) {
    const status = normStatus(inv.fiskalni_status);
    if (!["PLACENA", "PLACENO", "PAID"].includes(status)) continue;
    const r = await applyWriteoffToInvoice(Number(inv.faktura_id), { maxGap });
    results.push(r);
  }
  return {
    ok: true,
    partner_id: partnerId,
    year,
    max_gap: maxGap,
    applied_total_km: round2(results.reduce((a, r) => a + Number(r?.applied_km || 0), 0)),
    results,
  };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "").trim();

    if (mode === "invoice") {
      const faktura_id = Number(body?.faktura_id);
      const max_gap = Number(body?.max_gap);
      if (!Number.isFinite(faktura_id) || faktura_id <= 0) {
        return NextResponse.json({ ok: false, error: "INVALID_FAKTURA_ID" }, { status: 400 });
      }
      const result = await applyWriteoffToInvoice(
        faktura_id,
        { maxGap: Number.isFinite(max_gap) && max_gap > 0 ? max_gap : DEFAULT_MAX_GAP },
      );
      const status = result.ok ? 200 : 400;
      return NextResponse.json(result, { status });
    }

    if (mode === "client_year") {
      const partner_id = Number(body?.partner_id);
      const year = Number(body?.year) || new Date().getFullYear();
      const max_gap = Number(body?.max_gap);
      if (!Number.isFinite(partner_id) || partner_id <= 0) {
        return NextResponse.json({ ok: false, error: "INVALID_PARTNER_ID" }, { status: 400 });
      }
      const result = await applyForClientYear(partner_id, year, Number.isFinite(max_gap) && max_gap > 0 ? max_gap : DEFAULT_MAX_GAP);
      return NextResponse.json(result);
    }

    if (mode === "set_auto_client") {
      const partner_id = Number(body?.partner_id);
      const enabled = !!body?.enabled;
      if (!Number.isFinite(partner_id) || partner_id <= 0) {
        return NextResponse.json({ ok: false, error: "INVALID_PARTNER_ID" }, { status: 400 });
      }
      const result = await setAutoEnabled(partner_id, enabled);
      return NextResponse.json({ ok: true, partner_id, ...result });
    }

    return NextResponse.json({ ok: false, error: "INVALID_MODE" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const partner_id = Number(url.searchParams.get("partner_id"));
    if (!Number.isFinite(partner_id) || partner_id <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_PARTNER_ID" }, { status: 400 });
    }
    const enabled = await isAutoEnabled(partner_id);
    return NextResponse.json({ ok: true, partner_id, enabled, tag: AUTO_TAG });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
