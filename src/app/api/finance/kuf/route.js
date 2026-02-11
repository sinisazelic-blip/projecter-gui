import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const TIP_RASKNJIZAVANJA = [
  "PROJEKTNI_TROSAK",
  "FIKSNI_TROSAK",
  "VANREDNI_TROSAK",
  "INVESTICIJE",
];
const VANREDNI_PODTIP = ["SERVIS", "REPRO_MATERIJAL", "POTROSNI_MATERIJAL"];

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const tip = url.searchParams.get("tip") || "";
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(k.kuf_id AS CHAR) LIKE ? OR k.broj_fakture LIKE ? OR k.partner_naziv LIKE ? OR k.opis LIKE ? OR k.napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (TIP_RASKNJIZAVANJA.includes(tip)) {
      where.push("k.tip_rasknjizavanja = ?");
      params.push(tip);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await query(
      `
      SELECT
        k.kuf_id,
        k.broj_fakture,
        k.datum_fakture,
        k.datum_dospijeca,
        k.dobavljac_id,
        k.klijent_id,
        k.partner_naziv,
        k.iznos,
        k.valuta,
        k.iznos_km,
        k.opis,
        k.tip_rasknjizavanja,
        k.projekat_id,
        k.fiksni_trosak_id,
        k.vanredni_podtip,
        k.investicija_opis,
        k.status,
        d.naziv AS dobavljac_naziv,
        kl.naziv_klijenta AS klijent_naziv,
        p.radni_naziv AS projekat_naziv,
        f.naziv_troska AS fiksni_trosak_naziv
      FROM kuf_ulazne_fakture k
      LEFT JOIN dobavljaci d ON d.dobavljac_id = k.dobavljac_id
      LEFT JOIN klijenti kl ON kl.klijent_id = k.klijent_id
      LEFT JOIN projekti p ON p.projekat_id = k.projekat_id
      LEFT JOIN fiksni_troskovi f ON f.trosak_id = k.fiksni_trosak_id
      ${whereSql}
      ORDER BY k.datum_fakture DESC, k.kuf_id DESC
      LIMIT ?
      `,
      [...params, limit],
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
      broj_fakture,
      datum_fakture,
      datum_dospijeca,
      dobavljac_id,
      klijent_id,
      partner_naziv,
      iznos,
      valuta,
      iznos_km,
      kurs,
      opis,
      napomena,
      tip_rasknjizavanja,
      projekat_id,
      fiksni_trosak_id,
      vanredni_podtip,
      investicija_opis,
    } = body;

    if (!tip_rasknjizavanja || !TIP_RASKNJIZAVANJA.includes(tip_rasknjizavanja)) {
      return NextResponse.json(
        { ok: false, error: "Neispravan tip_rasknjizavanja" },
        { status: 400 },
      );
    }

    if (!datum_fakture) {
      return NextResponse.json(
        { ok: false, error: "Datum fakture je obavezan" },
        { status: 400 },
      );
    }

    const iznosNum = Number(iznos);
    if (!Number.isFinite(iznosNum) || iznosNum < 0) {
      return NextResponse.json(
        { ok: false, error: "Iznos mora biti pozitivan broj" },
        { status: 400 },
      );
    }

    const dobId = dobavljac_id ? Number(dobavljac_id) : null;
    const klId = klijent_id ? Number(klijent_id) : null;
    const projId = projekat_id ? Number(projekat_id) : null;
    const fiksId = fiksni_trosak_id ? Number(fiksni_trosak_id) : null;

    const val = (valuta || "BAM").trim().toUpperCase().slice(0, 10);
    const iznosKm =
      iznos_km != null && Number.isFinite(Number(iznos_km))
        ? Number(iznos_km)
        : val === "BAM"
          ? iznosNum
          : null;

    const vanredni =
      vanredni_podtip && VANREDNI_PODTIP.includes(vanredni_podtip)
        ? vanredni_podtip
        : null;

    const res = await query(
      `
      INSERT INTO kuf_ulazne_fakture
        (broj_fakture, datum_fakture, datum_dospijeca, dobavljac_id, klijent_id,
         partner_naziv, iznos, valuta, iznos_km, kurs, opis, napomena,
         tip_rasknjizavanja, projekat_id, fiksni_trosak_id, vanredni_podtip, investicija_opis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        broj_fakture || null,
        String(datum_fakture).slice(0, 10),
        datum_dospijeca ? String(datum_dospijeca).slice(0, 10) : null,
        dobId,
        klId,
        partner_naziv || null,
        iznosNum,
        val,
        iznosKm,
        kurs != null ? Number(kurs) : null,
        opis || null,
        napomena || null,
        tip_rasknjizavanja,
        projId,
        fiksId,
        vanredni,
        investicija_opis || null,
      ],
    );

    const id = res?.insertId ?? null;
    return NextResponse.json({ ok: true, kuf_id: id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
