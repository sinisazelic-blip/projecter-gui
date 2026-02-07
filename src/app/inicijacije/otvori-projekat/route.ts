import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function POST(req: NextRequest) {
  const conn = await (pool as any).getConnection();

  try {
    const body = await req.json().catch(() => ({}));
    const inicijacija_id = asInt(body?.inicijacija_id);

    if (!inicijacija_id || inicijacija_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "inicijacija_id je obavezan." },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    // ✅ Deal (inicijacija) FOR UPDATE
    const [irows]: any = await conn.query(
      `
      SELECT inicijacija_id, radni_naziv, projekat_id, narucilac_id
      FROM inicijacije
      WHERE inicijacija_id = ?
      FOR UPDATE
      `,
      [inicijacija_id]
    );

    const inic = Array.isArray(irows) && irows.length ? irows[0] : null;
    if (!inic) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Deal nije pronađen." }, { status: 404 });
    }

    if (inic.projekat_id) {
      await conn.commit();
      return NextResponse.json({ ok: true, projekat_id: inic.projekat_id });
    }

    if (!inic.narucilac_id) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Deal nema naručioca (narucilac_id). Ne mogu otvoriti projekat." },
        { status: 400 }
      );
    }

    // ✅ GATE: mora postojati accepted_deadline u zadnjem timeline eventu
    const [trows]: any = await conn.query(
      `
      SELECT accepted_deadline
      FROM deal_timeline_events
      WHERE inicijacija_id = ?
      ORDER BY created_at DESC, event_id DESC
      LIMIT 1
      `,
      [inicijacija_id]
    );

    const t = Array.isArray(trows) && trows.length ? trows[0] : null;
    if (!t || !t.accepted_deadline) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Ne može se otvoriti projekat bez prihvaćenog roka (Timeline)." },
        { status: 400 }
      );
    }

    // minimalno: projekat_id = MAX+1 (tvoj postojeći model)
    const [mrows]: any = await conn.query(`SELECT COALESCE(MAX(projekat_id), 0) AS mx FROM projekti`);
    const nextId = Number(mrows?.[0]?.mx ?? 0) + 1;

    // ✅ kreiraj projekat (sad uključuje narucilac_id)
    await conn.query(
      `
      INSERT INTO projekti (projekat_id, id_po, status_id, radni_naziv, narucilac_id)
      VALUES (?, ?, ?, ?, ?)
      `,
      [nextId, nextId, 3, inic.radni_naziv, inic.narucilac_id]
    );

    // ✅ upiši link nazad u inicijacije
    await conn.query(`UPDATE inicijacije SET projekat_id = ? WHERE inicijacija_id = ?`, [nextId, inicijacija_id]);

    // ✅ SNAPSHOT: prebaci stavke iz Deal-a u projekat_stavke
    // Pretpostavka: inicijacija_stavke ima kolone:
    // - stavka_id (ili inicijacija_stavka_id) -> koristimo alias kroz SELECT
    // - naziv/opis/kolicina/cijena_jedinicna/line_total
    //
    // Ako ti se primarni ključ u inicijacija_stavke zove drugačije, javi i promijenićemo 1 riječ.
    await conn.query(
      `
      INSERT INTO projekat_stavke
        (projekat_id, inicijacija_id, inicijacija_stavka_id, naziv, opis, kolicina, cijena_jedinicna, line_total)
      SELECT
        ?, s.inicijacija_id,
        s.stavka_id,
        s.naziv,
        s.opis,
        s.kolicina,
        s.cijena_jedinicna,
        s.line_total
      FROM inicijacija_stavke s
      WHERE s.inicijacija_id = ?
      `,
      [nextId, inicijacija_id]
    );

    await conn.commit();
    return NextResponse.json({ ok: true, projekat_id: nextId });
  } catch (e: any) {
    try {
      await conn.rollback();
    } catch {}
    return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
  } finally {
    try {
      conn.release();
    } catch {}
  }
}
