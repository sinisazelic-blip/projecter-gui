import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const posting_id = Number(url.searchParams.get("posting_id"));
    if (!Number.isFinite(posting_id) || posting_id <= 0) {
      return NextResponse.json({ ok: false, error: "posting_id invalid" }, { status: 400 });
    }

    const pRows = await query(
      `SELECT posting_id, counterparty, description, amount
       FROM bank_tx_posting
       WHERE posting_id = ?
       LIMIT 1`,
      [posting_id],
    );
    if (!pRows?.length) return NextResponse.json({ ok: false, error: "Posting ne postoji" }, { status: 404 });
    const p = pRows[0];

    const [candidatesRaw, paidRaw] = await Promise.all([
      query(
        `SELECT k.klijent_id, k.naziv_klijenta, COALESCE(ps.iznos_potrazuje,0) AS pocetno
         FROM klijenti k
         LEFT JOIN klijent_pocetno_stanje ps ON ps.klijent_id = k.klijent_id AND COALESCE(ps.otpisano,0)=0`,
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
        return {
          ref_id: id,
          naziv: name,
          preostalo: Math.round(Math.max(0, left) * 100) / 100,
          score: scoreMatch(token, normalize(name)),
        };
      })
      .filter((x) => x.preostalo > 0.009)
      .sort((a, b) => b.score - a.score || b.preostalo - a.preostalo || a.naziv.localeCompare(b.naziv, "sr"))
      .slice(0, 20);

    return NextResponse.json({ ok: true, posting_id, amount: Number(p.amount || 0), candidates });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}

