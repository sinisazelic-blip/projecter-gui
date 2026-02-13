import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET: Lista faza projekta sa radnicima
 * POST: Nova faza
 */
export async function GET(req, { params }) {
  const { id } = await params;
  const projekatId = Number(id);
  if (!Number.isFinite(projekatId))
    return NextResponse.json({ ok: false, error: "Neispravan projekat_id" }, { status: 400 });

  try {
    const faze = await query(
      `
      SELECT
        pf.projekat_faza_id,
        pf.projekat_id,
        pf.faza_id,
        pf.naziv,
        pf.datum_pocetka,
        pf.datum_kraja,
        pf.deadline,
        pf.procenat_izvrsenosti,
        pf.redoslijed,
        pf.napomena,
        rf.naziv AS faza_naziv
      FROM projekat_faze pf
      LEFT JOIN radne_faze rf ON rf.faza_id = pf.faza_id
      WHERE pf.projekat_id = ?
      ORDER BY pf.redoslijed ASC, pf.projekat_faza_id ASC
      `,
      [projekatId]
    );

    const [radniciByFaza, dobavljaciByFaza] = await Promise.all([
      query(
        `
        SELECT pfr.projekat_faza_id, pfr.radnik_id, r.ime, r.prezime
        FROM projekat_faza_radnici pfr
        JOIN radnici r ON r.radnik_id = pfr.radnik_id
        WHERE pfr.projekat_faza_id IN (
          SELECT projekat_faza_id FROM projekat_faze WHERE projekat_id = ?
        )
        `,
        [projekatId]
      ),
      query(
        `
        SELECT pfd.projekat_faza_id, pfd.dobavljac_id, d.naziv
        FROM projekat_faza_dobavljaci pfd
        JOIN dobavljaci d ON d.dobavljac_id = pfd.dobavljac_id
        WHERE pfd.projekat_faza_id IN (
          SELECT projekat_faza_id FROM projekat_faze WHERE projekat_id = ?
        )
        `,
        [projekatId]
      ).catch(() => []),
    ]);

    const radMap = {};
    for (const r of radniciByFaza || []) {
      const fid = r.projekat_faza_id;
      if (!radMap[fid]) radMap[fid] = [];
      radMap[fid].push({ radnik_id: r.radnik_id, ime: r.ime, prezime: r.prezime });
    }

    const dobMap = {};
    for (const d of dobavljaciByFaza || []) {
      const fid = d.projekat_faza_id;
      if (!dobMap[fid]) dobMap[fid] = [];
      dobMap[fid].push({ dobavljac_id: d.dobavljac_id, naziv: d.naziv });
    }

    for (const f of faze || []) {
      f.radnici = radMap[f.projekat_faza_id] || [];
      f.dobavljaci = dobMap[f.projekat_faza_id] || [];
    }

    return NextResponse.json({ ok: true, faze: faze || [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška" },
      { status: 500 }
    );
  }
}

export async function POST(req, { params }) {
  const { id } = await params;
  const projekatId = Number(id);
  if (!Number.isFinite(projekatId))
    return NextResponse.json({ ok: false, error: "Neispravan projekat_id" }, { status: 400 });

  try {
    const body = await req.json();
    const fazaId = body.faza_id ? Number(body.faza_id) : null;
    const naziv = String(body.naziv || "").trim() || null;
    const datumPocetka = body.datum_pocetka ? String(body.datum_pocetka).slice(0, 10) : null;
    const datumKraja = body.datum_kraja ? String(body.datum_kraja).slice(0, 10) : null;
    const deadline = body.deadline ? String(body.deadline).slice(0, 10) : null;
    const procenat = Math.min(100, Math.max(0, Number(body.procenat_izvrsenosti) || 0));
    const redoslijed = Number(body.redoslijed) || 0;
    const napomena = body.napomena ? String(body.napomena).trim() : null;
    const dobavljacIds = Array.isArray(body.dobavljac_ids) ? body.dobavljac_ids.map(Number).filter(Boolean) : [];
    const radnikIds = Array.isArray(body.radnik_ids) ? body.radnik_ids.map(Number).filter(Boolean) : [];

    const [maxOrder] = await query(
      `SELECT COALESCE(MAX(redoslijed), 0) AS mx FROM projekat_faze WHERE projekat_id = ?`,
      [projekatId]
    );
    const order = redoslijed > 0 ? redoslijed : (maxOrder?.[0]?.mx ?? 0) + 1;

    const ins = await query(
      `
      INSERT INTO projekat_faze
        (projekat_id, faza_id, naziv, datum_pocetka, datum_kraja, deadline, procenat_izvrsenosti, redoslijed, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [projekatId, fazaId, naziv, datumPocetka, datumKraja, deadline, procenat, order, napomena]
    );

    const projekatFazaId = ins?.insertId;
    if (!projekatFazaId) throw new Error("Insert nije vratio ID");

    for (const did of dobavljacIds) {
      await query(
        `INSERT IGNORE INTO projekat_faza_dobavljaci (projekat_faza_id, dobavljac_id) VALUES (?, ?)`,
        [projekatFazaId, did]
      ).catch(() => {}); // Ignore ako tabela ne postoji
    }

    for (const rid of radnikIds) {
      await query(
        `INSERT IGNORE INTO projekat_faza_radnici (projekat_faza_id, radnik_id) VALUES (?, ?)`,
        [projekatFazaId, rid]
      );
    }

    return NextResponse.json({ ok: true, projekat_faza_id: projekatFazaId });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška" },
      { status: 500 }
    );
  }
}
