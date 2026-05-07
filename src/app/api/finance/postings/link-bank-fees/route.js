import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const FEE_KEYWORDS = [
  "provizija",
  "naknada",
  "naknade",
  "gpp naknade",
  "fee",
  "vodjenje",
  "vodenje",
  "vođenje",
  "odrzavanje",
  "odrzavanje racuna",
  "održavanje računa",
  "trosak",
];

const NON_FEE_HINTS = [
  "kredit",
  "rata",
  "pdv",
  "porez",
  "fiskal",
  "stari dug",
  "prenos",
  "uplata",
  "isplata",
];

function isLikelyBankFee(text) {
  const t = String(text || "").toLowerCase();
  const looksLikeFee = FEE_KEYWORDS.some((k) => t.includes(k));
  const looksLikeNonFee = NON_FEE_HINTS.some((k) => t.includes(k));
  return looksLikeFee && !looksLikeNonFee;
}

function isServicePayment(row) {
  const desc = String(row?.description || "").toLowerCase();
  const counterparty = String(row?.counterparty || "").trim();
  return desc.includes("naknada za usluge") && counterparty.length > 0;
}

function bad(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

function toDateInput(v) {
  if (!v) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedIds = Array.isArray(body?.posting_ids)
      ? body.posting_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : null;

    let rows = await query(
      `SELECT posting_id, value_date, amount, currency, counterparty, description
       FROM v_bank_posting_unlinked
       WHERE amount < 0
       ORDER BY posting_id DESC
       LIMIT 1000`,
    );
    rows = Array.isArray(rows) ? rows : [];

    if (requestedIds?.length) {
      const set = new Set(requestedIds);
      rows = rows.filter((r) => set.has(Number(r.posting_id)));
    }

    const candidates = rows.filter((r) =>
      isLikelyBankFee(`${r?.description || ""} ${r?.counterparty || ""}`),
    );
    const ownerPrivateAccountRaw = process.env.FLUXA_OWNER_PRIVATE_ACCOUNT?.trim() || "";
    const ownerDigits = ownerPrivateAccountRaw.replace(/\D+/g, "");
    const transferWords = ["prenos", "posudba vlasnika", "uplata vlasnika"];
    const safeCandidates = candidates.filter((r) => {
      if (!ownerDigits) return true;
      const text = `${r?.description || ""} ${r?.counterparty || ""}`.toLowerCase();
      const digits = String(text).replace(/\D+/g, "");
      const ownerHit = digits.includes(ownerDigits);
      const transferHit = transferWords.some((w) => text.includes(w));
      return !(ownerHit && transferHit);
    }).filter((r) => !isServicePayment(r));
    if (!safeCandidates.length) {
      return NextResponse.json({ ok: true, linked_count: 0, skipped_count: rows.length });
    }

    let linked = 0;
    let skipped = 0;

    for (const row of safeCandidates) {
      const posting_id = Number(row.posting_id);
      const amount = Math.abs(Number(row.amount || 0));
      const datum = toDateInput(row.value_date);
      if (!posting_id || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
        skipped += 1;
        continue;
      }

      const referenca = `posting_id=${posting_id}`;
      const napomena = String(row.description || row.counterparty || "Bankovna provizija").slice(0, 255);

      try {
        const insPay = await query(
          `INSERT INTO placanja
            (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
           VALUES
            (?, ?, 'BAM', 1.000000, ?, 'BANK', ?, ?)`,
          [datum, amount, amount, referenca, napomena],
        );
        let placanje_id = insPay?.insertId ?? insPay?.rows?.insertId;
        if (!placanje_id) {
          const pRows = await query(
            `SELECT placanje_id
             FROM placanja
             WHERE referenca = ?
             ORDER BY placanje_id DESC
             LIMIT 1`,
            [referenca],
          );
          placanje_id = pRows?.[0]?.placanje_id ?? null;
        }
        if (!placanje_id) {
          skipped += 1;
          continue;
        }

        await query(
          `INSERT INTO bank_tx_posting_placanje_link
            (posting_id, placanje_id, amount_km, aktivan)
           VALUES
            (?, ?, ?, 1)`,
          [posting_id, placanje_id, amount],
        );
        await query(
          `UPDATE bank_tx_posting
           SET kategorija = 'provizija'
           WHERE posting_id = ?`,
          [posting_id],
        );
        linked += 1;
      } catch {
        skipped += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      linked_count: linked,
      skipped_count: skipped,
      scanned_count: safeCandidates.length,
    });
  } catch (e) {
    return bad(e?.message || "Unknown error", 500);
  }
}

