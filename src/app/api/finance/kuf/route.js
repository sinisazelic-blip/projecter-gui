import { NextResponse } from "next/server";
import { query } from "@/lib/db";

async function hasKufColumn(column) {
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
    const pdvSelect = (await hasKufColumn("pdv_iznos_km")) ? "k.pdv_iznos_km," : "NULL AS pdv_iznos_km,";
    const prijemSelect = (await hasKufColumn("datum_prijema")) ? "k.datum_prijema," : "NULL AS datum_prijema,";

    const rows = await query(
      `
      SELECT
        k.kuf_id,
        k.broj_fakture,
        k.datum_fakture,
        k.datum_dospijeca,
        ${prijemSelect}
        k.dobavljac_id,
        k.klijent_id,
        k.partner_naziv,
        k.iznos,
        k.valuta,
        k.iznos_km,
        ${pdvSelect}
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
      datum_prijema,
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
      pdv_iznos_km,
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

    const valRaw = String(valuta || "BAM").trim().toUpperCase().slice(0, 10);
    const val = valRaw === "KM" ? "BAM" : valRaw;
    const iznosKm =
      iznos_km != null && Number.isFinite(Number(iznos_km))
        ? Number(iznos_km)
        : val === "BAM"
          ? iznosNum
          : null;

    const hasPdvCol = await hasKufColumn("pdv_iznos_km");
    let pdvKm = null;
    if (hasPdvCol) {
      let p = 0;
      if (pdv_iznos_km != null && String(pdv_iznos_km).trim() !== "") {
        p = Number(pdv_iznos_km);
        if (!Number.isFinite(p) || p < 0) {
          return NextResponse.json(
            { ok: false, error: "Iznos PDV-a mora biti nenegativan broj" },
            { status: 400 },
          );
        }
      }
      pdvKm = Math.round(p * 100) / 100;
      if (pdvKm > 0 && (iznosKm == null || !Number.isFinite(iznosKm))) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Za unos ulaznog PDV-a potrebno je ukupan iznos u KM (polje „Iznos (ekvivalent)” ili valuta KM).",
          },
          { status: 400 },
        );
      }
      if (iznosKm != null && Number.isFinite(iznosKm) && pdvKm > iznosKm + 0.001) {
        return NextResponse.json(
          { ok: false, error: "Iznos PDV-a ne može biti veći od ukupnog iznosa u KM." },
          { status: 400 },
        );
      }
    }

    const vanredni =
      vanredni_podtip && VANREDNI_PODTIP.includes(vanredni_podtip)
        ? vanredni_podtip
        : null;
    const hasDatumPrijema = await hasKufColumn("datum_prijema");
    const prijemDate = datum_prijema ? String(datum_prijema).slice(0, 10) : null;
    let res;
    if (hasPdvCol) {
      res = await query(
        `
      INSERT INTO kuf_ulazne_fakture
        (broj_fakture, datum_fakture, datum_dospijeca, ${hasDatumPrijema ? "datum_prijema," : ""}
         dobavljac_id, klijent_id,
         partner_naziv, iznos, valuta, iznos_km, pdv_iznos_km, kurs, opis, napomena,
         tip_rasknjizavanja, projekat_id, fiksni_trosak_id, vanredni_podtip, investicija_opis)
      VALUES (?, ?, ?, ${hasDatumPrijema ? "?," : ""} ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          broj_fakture || null,
          String(datum_fakture).slice(0, 10),
          datum_dospijeca ? String(datum_dospijeca).slice(0, 10) : null,
          ...(hasDatumPrijema ? [prijemDate] : []),
          dobId,
          klId,
          partner_naziv || null,
          iznosNum,
          val,
          iznosKm,
          pdvKm,
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
    } else {
      res = await query(
        `
      INSERT INTO kuf_ulazne_fakture
        (broj_fakture, datum_fakture, datum_dospijeca, ${hasDatumPrijema ? "datum_prijema," : ""}
         dobavljac_id, klijent_id,
         partner_naziv, iznos, valuta, iznos_km, kurs, opis, napomena,
         tip_rasknjizavanja, projekat_id, fiksni_trosak_id, vanredni_podtip, investicija_opis)
      VALUES (?, ?, ?, ${hasDatumPrijema ? "?," : ""} ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          broj_fakture || null,
          String(datum_fakture).slice(0, 10),
          datum_dospijeca ? String(datum_dospijeca).slice(0, 10) : null,
          ...(hasDatumPrijema ? [prijemDate] : []),
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
    }

    const id = res?.insertId ?? null;
    return NextResponse.json({ ok: true, kuf_id: id });
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
      kuf_id,
      broj_fakture,
      datum_fakture,
      datum_dospijeca,
      datum_prijema,
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
      pdv_iznos_km,
    } = body;

    const kufIdNum = Number(kuf_id);
    if (!Number.isFinite(kufIdNum) || kufIdNum <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan kuf_id" },
        { status: 400 },
      );
    }

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

    const valRaw = String(valuta || "BAM").trim().toUpperCase().slice(0, 10);
    const val = valRaw === "KM" ? "BAM" : valRaw;
    const iznosKm =
      iznos_km != null && Number.isFinite(Number(iznos_km))
        ? Number(iznos_km)
        : val === "BAM"
          ? iznosNum
          : null;

    const hasPdvCol = await hasKufColumn("pdv_iznos_km");
    let pdvKm = null;
    if (hasPdvCol) {
      let p = 0;
      if (pdv_iznos_km != null && String(pdv_iznos_km).trim() !== "") {
        p = Number(pdv_iznos_km);
        if (!Number.isFinite(p) || p < 0) {
          return NextResponse.json(
            { ok: false, error: "Iznos PDV-a mora biti nenegativan broj" },
            { status: 400 },
          );
        }
      }
      pdvKm = Math.round(p * 100) / 100;
      if (pdvKm > 0 && (iznosKm == null || !Number.isFinite(iznosKm))) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Za unos ulaznog PDV-a potrebno je ukupan iznos u KM (polje „Iznos (ekvivalent)” ili valuta KM).",
          },
          { status: 400 },
        );
      }
      if (iznosKm != null && Number.isFinite(iznosKm) && pdvKm > iznosKm + 0.001) {
        return NextResponse.json(
          { ok: false, error: "Iznos PDV-a ne može biti veći od ukupnog iznosa u KM." },
          { status: 400 },
        );
      }
    }

    const vanredni =
      vanredni_podtip && VANREDNI_PODTIP.includes(vanredni_podtip)
        ? vanredni_podtip
        : null;
    const hasDatumPrijema = await hasKufColumn("datum_prijema");
    const prijemDate = datum_prijema ? String(datum_prijema).slice(0, 10) : null;

    if (hasPdvCol) {
      await query(
        `
      UPDATE kuf_ulazne_fakture
      SET
        broj_fakture = ?,
        datum_fakture = ?,
        datum_dospijeca = ?,
        ${hasDatumPrijema ? "datum_prijema = ?," : ""}
        dobavljac_id = ?,
        klijent_id = ?,
        partner_naziv = ?,
        iznos = ?,
        valuta = ?,
        iznos_km = ?,
        pdv_iznos_km = ?,
        kurs = ?,
        opis = ?,
        napomena = ?,
        tip_rasknjizavanja = ?,
        projekat_id = ?,
        fiksni_trosak_id = ?,
        vanredni_podtip = ?,
        investicija_opis = ?
      WHERE kuf_id = ?
      `,
        [
          broj_fakture || null,
          String(datum_fakture).slice(0, 10),
          datum_dospijeca ? String(datum_dospijeca).slice(0, 10) : null,
          ...(hasDatumPrijema ? [prijemDate] : []),
          dobId,
          klId,
          partner_naziv || null,
          iznosNum,
          val,
          iznosKm,
          pdvKm,
          kurs != null ? Number(kurs) : null,
          opis || null,
          napomena || null,
          tip_rasknjizavanja,
          projId,
          fiksId,
          vanredni,
          investicija_opis || null,
          kufIdNum,
        ],
      );
    } else {
      await query(
        `
      UPDATE kuf_ulazne_fakture
      SET
        broj_fakture = ?,
        datum_fakture = ?,
        datum_dospijeca = ?,
        ${hasDatumPrijema ? "datum_prijema = ?," : ""}
        dobavljac_id = ?,
        klijent_id = ?,
        partner_naziv = ?,
        iznos = ?,
        valuta = ?,
        iznos_km = ?,
        kurs = ?,
        opis = ?,
        napomena = ?,
        tip_rasknjizavanja = ?,
        projekat_id = ?,
        fiksni_trosak_id = ?,
        vanredni_podtip = ?,
        investicija_opis = ?
      WHERE kuf_id = ?
      `,
        [
          broj_fakture || null,
          String(datum_fakture).slice(0, 10),
          datum_dospijeca ? String(datum_dospijeca).slice(0, 10) : null,
          ...(hasDatumPrijema ? [prijemDate] : []),
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
          kufIdNum,
        ],
      );
    }

    return NextResponse.json({ ok: true, kuf_id: kufIdNum });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
