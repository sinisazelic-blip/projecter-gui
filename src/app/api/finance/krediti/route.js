import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req) {
  try {
    const cols = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'krediti'`,
      [],
    ).catch(() => []);
    const set = new Set((cols ?? []).map((c) => String(c.column_name)));
    const hasIznosKredita = set.has("iznos_kredita");
    const hasKamataTroskovi = set.has("iznos_kamata_troskovi");

    const rows = await query(
      `
      SELECT
        k.*,
        ${hasIznosKredita ? "k.iznos_kredita" : "NULL AS iznos_kredita"},
        ${hasKamataTroskovi ? "k.iznos_kamata_troskovi" : "NULL AS iznos_kamata_troskovi"}
      FROM krediti k
      ORDER BY aktivan DESC, datum_posljednja_rata DESC, kredit_id DESC
      LIMIT 100
      `,
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
      iznos_kredita,
      iznos_kamata_troskovi,
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

    const glavnica = Math.max(0, Number(iznos_kredita ?? 0));
    const kamataTroskovi = Math.max(0, Number(iznos_kamata_troskovi ?? 0));
    const ukupnoRaw = Number(ukupan_iznos ?? glavnica + kamataTroskovi);
    const ukupno = Number.isFinite(ukupnoRaw) ? ukupnoRaw : glavnica + kamataTroskovi;
    const brRata = Math.max(0, Number(broj_rata ?? 0));
    const uplaceno = Math.max(0, Math.min(brRata, Number(uplaceno_rata ?? 0)));
    const iznosRate =
      iznos_rate != null && Number.isFinite(Number(iznos_rate))
        ? Number(iznos_rate)
        : brRata > 0
          ? ukupno / brRata
          : null;

    const datum = datum_posljednja_rata
      ? String(datum_posljednja_rata).slice(0, 10)
      : null;

    const cols = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'krediti'`,
      [],
    ).catch(() => []);
    const set = new Set((cols ?? []).map((c) => String(c.column_name)));
    const hasIznosKredita = set.has("iznos_kredita");
    const hasKamataTroskovi = set.has("iznos_kamata_troskovi");

    let res;
    if (hasIznosKredita && hasKamataTroskovi) {
      res = await query(
        `INSERT INTO krediti
          (naziv, iznos_kredita, iznos_kamata_troskovi, ukupan_iznos, valuta, broj_rata, uplaceno_rata, iznos_rate, datum_posljednja_rata, banka_naziv, napomena)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(naziv).trim(),
          glavnica,
          kamataTroskovi,
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
    } else {
      res = await query(
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
    }

    const id = res?.insertId ?? null;
    return NextResponse.json({ ok: true, kredit_id: id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const {
      kredit_id,
      naziv,
      iznos_kredita,
      iznos_kamata_troskovi,
      ukupan_iznos,
      valuta,
      broj_rata,
      uplaceno_rata,
      iznos_rate,
      datum_posljednja_rata,
      banka_naziv,
      napomena,
      aktivan,
    } = body ?? {};

    const id = Number(kredit_id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan kredit_id" },
        { status: 400 },
      );
    }
    if (!naziv || !String(naziv).trim()) {
      return NextResponse.json(
        { ok: false, error: "Naziv je obavezan" },
        { status: 400 },
      );
    }

    const glavnica = Math.max(0, Number(iznos_kredita ?? 0));
    const kamataTroskovi = Math.max(0, Number(iznos_kamata_troskovi ?? 0));
    const ukupnoRaw = Number(ukupan_iznos ?? glavnica + kamataTroskovi);
    const ukupno = Number.isFinite(ukupnoRaw) ? ukupnoRaw : glavnica + kamataTroskovi;
    const brRata = Math.max(0, Number(broj_rata ?? 0));
    const uplaceno = Math.max(0, Math.min(brRata, Number(uplaceno_rata ?? 0)));
    const iznosRate =
      iznos_rate != null && Number.isFinite(Number(iznos_rate))
        ? Number(iznos_rate)
        : brRata > 0
          ? ukupno / brRata
          : null;
    const datum = datum_posljednja_rata
      ? String(datum_posljednja_rata).slice(0, 10)
      : null;
    const isActive = aktivan == null ? 1 : Number(aktivan) ? 1 : 0;

    const cols = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'krediti'`,
      [],
    ).catch(() => []);
    const set = new Set((cols ?? []).map((c) => String(c.column_name)));
    const hasIznosKredita = set.has("iznos_kredita");
    const hasKamataTroskovi = set.has("iznos_kamata_troskovi");

    if (hasIznosKredita && hasKamataTroskovi) {
      await query(
        `UPDATE krediti
         SET naziv = ?,
             iznos_kredita = ?,
             iznos_kamata_troskovi = ?,
             ukupan_iznos = ?,
             valuta = ?,
             broj_rata = ?,
             uplaceno_rata = ?,
             iznos_rate = ?,
             datum_posljednja_rata = ?,
             banka_naziv = ?,
             napomena = ?,
             aktivan = ?
         WHERE kredit_id = ?`,
        [
          String(naziv).trim(),
          glavnica,
          kamataTroskovi,
          ukupno,
          (valuta || "BAM").trim().slice(0, 10),
          brRata,
          uplaceno,
          iznosRate,
          datum,
          banka_naziv ? String(banka_naziv).trim() : null,
          napomena ? String(napomena).trim() : null,
          isActive,
          id,
        ],
      );
    } else {
      await query(
        `UPDATE krediti
         SET naziv = ?,
             ukupan_iznos = ?,
             valuta = ?,
             broj_rata = ?,
             uplaceno_rata = ?,
             iznos_rate = ?,
             datum_posljednja_rata = ?,
             banka_naziv = ?,
             napomena = ?,
             aktivan = ?
         WHERE kredit_id = ?`,
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
          isActive,
          id,
        ],
      );
    }

    return NextResponse.json({ ok: true, kredit_id: id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { kredit_id, action = "advance_payment", count, date } = body;
    const kreditIdNum = Number(kredit_id);

    if (!kreditIdNum) {
      return NextResponse.json({ ok: false, error: "kredit_id je obavezan" }, { status: 400 });
    }

    const [kredit] = await query(`SELECT * FROM krediti WHERE kredit_id = ?`, [kreditIdNum]);
    if (!kredit) {
      return NextResponse.json({ ok: false, error: "Kredit nije pronađen" }, { status: 404 });
    }

    let newUplaceno = kredit.uplaceno_rata || 0;
    const newDatum = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (action === "advance_payment") {
      newUplaceno = Math.min(kredit.broj_rata, newUplaceno + 1);
    } else if (action === "decrement_payment") {
      newUplaceno = Math.max(0, newUplaceno - 1);
    } else if (action === "set_paid_count" && count !== undefined) {
      newUplaceno = Math.max(0, Math.min(kredit.broj_rata, Number(count)));
    }

    await query(
      `UPDATE krediti SET uplaceno_rata = ?, datum_posljednja_rata = ? WHERE kredit_id = ?`,
      [newUplaceno, newDatum, kreditIdNum]
    );

    return NextResponse.json({
      ok: true,
      kredit_id: kreditIdNum,
      uplaceno_rata: newUplaceno,
      broj_rata: kredit.broj_rata,
      preostalo_rata: kredit.broj_rata - newUplaceno,
      datum_posljednja_rata: newDatum,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

