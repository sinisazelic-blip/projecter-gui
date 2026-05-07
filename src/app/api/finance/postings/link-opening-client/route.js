import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function bad(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(token, clientNameNorm) {
  if (!token || !clientNameNorm) return 0;
  if (token.includes(clientNameNorm)) return 100;
  const tokenWords = new Set(token.split(" ").filter(Boolean));
  const nameWords = clientNameNorm.split(" ").filter(Boolean);
  if (!nameWords.length) return 0;
  let hits = 0;
  for (const w of nameWords) if (tokenWords.has(w)) hits += 1;
  return Math.round((hits / nameWords.length) * 100);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const posting_id = Number(body?.posting_id);
    const explicitRefId = Number(body?.ref_id || 0);
    if (!Number.isFinite(posting_id) || posting_id <= 0) return bad("posting_id invalid");

    const pRows = await query(
      `SELECT posting_id, value_date, amount, counterparty, description
       FROM bank_tx_posting
       WHERE posting_id = ?
       LIMIT 1`,
      [posting_id],
    );
    if (!pRows?.length) return bad("Posting ne postoji", 404);
    const p = pRows[0];
    const amount = Number(p.amount);
    if (!(amount > 0)) return bad("Početno stanje klijenta može se vezati samo na priliv (amount > 0)");

    const dup = await query(
      `SELECT uplata_id FROM pocetno_stanje_uplate
       WHERE tip='klijent' AND posting_id=? AND aktivan=1
       LIMIT 1`,
      [posting_id],
    ).catch(() => []);
    if (dup?.length) return NextResponse.json({ ok: true, already_linked: true, uplata_id: dup[0].uplata_id });

    let ref_id = explicitRefId;
    if (!Number.isFinite(ref_id) || ref_id <= 0) {
      const [candidatesRaw, paidRaw] = await Promise.all([
        query(
          `SELECT klijent_id, naziv_klijenta, COALESCE(iznos_potrazuje,0) AS pocetno
           FROM klijent_pocetno_stanje
           WHERE COALESCE(otpisano,0)=0`,
        ).catch(() => []),
        query(
          `SELECT ref_id, ROUND(SUM(COALESCE(amount_km,0)),2) AS paid
           FROM pocetno_stanje_uplate
           WHERE tip='klijent' AND aktivan=1
           GROUP BY ref_id`,
        ).catch(() => []),
      ]);
      const paidMap = new Map((paidRaw || []).map((r) => [Number(r.ref_id), Number(r.paid || 0)]));
      const token = normalize(`${p.counterparty || ""} ${p.description || ""}`);
      const candidates = (candidatesRaw || [])
        .map((c) => {
          const id = Number(c.klijent_id);
          const left = Number(c.pocetno || 0) - Number(paidMap.get(id) || 0);
          const name = String(c.naziv_klijenta || "");
          const nameNorm = normalize(name);
          const score = scoreMatch(token, nameNorm);
          return {
            id,
            name,
            left: Math.round(Math.max(0, left) * 100) / 100,
            score,
          };
        })
        .filter((x) => x.left > 0.009)
        .sort((a, b) => b.score - a.score || b.left - a.left || a.name.localeCompare(b.name, "sr"));

      // Auto-link samo kad postoji jedan jasan kandidat.
      if (candidates.length === 1 && candidates[0].score >= 40) {
        ref_id = candidates[0].id;
      } else if (candidates.length > 1 && candidates[0].score >= 70 && candidates[1].score < 40) {
        ref_id = candidates[0].id;
      } else {
        return bad("Nije moguće jednoznačno odrediti klijenta za početno stanje.", 400, {
          candidates: candidates.slice(0, 8).map((c) => ({ ref_id: c.id, naziv: c.name, preostalo: c.left })),
        });
      }
    }

    const datum = String(p.value_date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return bad("Neispravan datum na postingu");
    const amount_km = Math.round(amount * 100) / 100;
    await query(
      `INSERT INTO pocetno_stanje_uplate
        (tip, ref_id, posting_id, datum, amount_km, napomena, aktivan)
       VALUES
        ('klijent', ?, ?, ?, ?, ?, 1)`,
      [ref_id, posting_id, datum, amount_km, `Auto link početnog stanja [posting ${posting_id}]`],
    );
    await query(`UPDATE bank_tx_posting SET kategorija='pocetno_stanje' WHERE posting_id=?`, [posting_id]).catch(() => {});

    return NextResponse.json({ ok: true, posting_id, ref_id, amount_km });
  } catch (e) {
    return bad(e?.message || "Unknown error", 500);
  }
}

