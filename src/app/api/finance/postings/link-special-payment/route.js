import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPES = {
  pdv: { label: "PDV", kategorija: "pdv", nacin: "BANK_PDV" },
  porez: { label: "Porez", kategorija: "porez", nacin: "BANK_POREZ" },
  fiskalne: { label: "Fiskalne kase", kategorija: "fiskalne_kase", nacin: "BANK_FISKALNE" },
  kredit: { label: "Kredit", kategorija: "kredit", nacin: "BANK_KREDIT" },
};

function bad(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const posting_id = Number(body?.posting_id);
    const datum = String(body?.datum || "");
    const vrsta = String(body?.vrsta || "").trim().toLowerCase();
    const cfg = TYPES[vrsta];
    if (!cfg) return bad("Neispravna vrsta linka.");
    if (!Number.isFinite(posting_id) || posting_id <= 0) return bad("posting_id invalid");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return bad("datum must be YYYY-MM-DD");

    const pRows = await query(
      `SELECT posting_id, amount, value_date, currency, counterparty, description
       FROM bank_tx_posting
       WHERE posting_id = ?`,
      [posting_id],
    );
    if (!pRows?.length) return bad("posting not found", 404);
    const posting = pRows[0];
    const amountRaw = Number(posting.amount);
    if (!Number.isFinite(amountRaw) || amountRaw === 0) return bad("Posting amount invalid");
    const amountKm = Math.round(Math.abs(amountRaw) * 100) / 100;

    const sRows = await query(
      `SELECT posting_id, amount, linked_total_km
       FROM v_bank_posting_sanity
       WHERE posting_id = ?`,
      [posting_id],
    );
    const used = Number(sRows?.[0]?.linked_total_km ?? 0);
    const cap = Math.abs(Number(sRows?.[0]?.amount ?? amountRaw));
    if (used + amountKm > cap + 0.00001) {
      return bad("Would over-allocate posting", 400, { cap, used, try_add: amountKm });
    }

    // Kredit incoming ne knjižimo kao trošak; pravimo neutralni link (iznos_km=0).
    const isCreditIncoming = vrsta === "kredit" && amountRaw > 0;
    const placanjeIznosKm = isCreditIncoming ? 0 : amountKm;
    const referenca = `${vrsta}:posting_id=${posting_id}`;
    const napomena = `${cfg.label} [posting ${posting_id}] ${String(posting.description || "").slice(0, 180)}`.trim();

    const insPay = await query(
      `INSERT INTO placanja
        (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
       VALUES
        (?, ?, 'BAM', 1.000000, ?, ?, ?, ?)`,
      [datum, amountKm, placanjeIznosKm, cfg.nacin, referenca, napomena],
    );
    const placanje_id = insPay?.insertId ?? insPay?.rows?.insertId;
    if (!placanje_id) return bad("Failed to create placanje", 500);

    await query(
      `INSERT INTO bank_tx_posting_placanje_link
        (posting_id, placanje_id, amount_km, aktivan)
       VALUES
        (?, ?, ?, 1)`,
      [posting_id, placanje_id, amountKm],
    );
    await query(`UPDATE bank_tx_posting SET kategorija = ? WHERE posting_id = ?`, [cfg.kategorija, posting_id]);

    return NextResponse.json({
      ok: true,
      posting_id,
      placanje_id,
      vrsta,
      neutral_entry: isCreditIncoming,
    });
  } catch (e) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}

