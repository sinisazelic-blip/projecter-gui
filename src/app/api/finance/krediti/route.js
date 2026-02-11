import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req) {
  try {
    const rows = await query(
      `SELECT * FROM krediti ORDER BY aktivan DESC, datum_posljednja_rata DESC, kredit_id DESC LIMIT 100`,
      [],
    ).catch(() => []);
    return NextResponse.json({ ok: true, rows: rows ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      naziv,
      ukupan_iznos,
      valuta,
      broj_rata,
      uplaceno_rata,
      iznos_rate,
      datum_posljednja_rata,
      banka_naziv,
      napomena,
    } = body;

    if (!naziv || !String(naziv).trim()) {
      return NextResponse.json(
        { ok: false, error: "Naziv je obavezan" },
        { status: 400 },
      );
    }

    const ukupno = Number(ukupan_iznos ?? 0);
    const brRata = Math.max(0, Number(broj_rata ?? 0));
    const uplaceno = Math.max(0, Math.min(brRata, Number(uplaceno_rata ?? 0)));
    const iznosRate = iznos_rate != null && Number.isFinite(Number(iznos_rate))
      ? Number(iznos_rate)
      : null;

    const datum = datum_posljednja_rata
      ? String(datum_posljednja_rata).slice(0, 10)
      : null;

    const res = await query(
      `INSERT INTO krediti
        (naziv, ukupan_iznos, valuta, broj_rata, uplaceno_rata, iznos_rate, datum_posljednja_rata, banka_naziv, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(naziv).trim(),
        ukupno,
        (valuta || "BAM").trim().slice(0, 10),
        brRata,
        uplaceno,
        iznosRate,
        datum,
        banka_naziv ? String(banka_naziv).trim() : null,
        napomena ? String(napomena).trim() : null,
      ],
    );

    const id = res?.insertId ?? null;
    return NextResponse.json({ ok: true, kredit_id: id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
