import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// helper: siguran int
function toInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const x = Math.trunc(n);
  if (x <= 0) return null;
  return x;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = toInt(url.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ ok: false, error: "Nedostaje ili neispravan id." }, { status: 400 });
    }

    const rows: any[] = await query(
      `
      SELECT
        i.inicijacija_id,
        i.narucilac_id,
        i.krajnji_klijent_id,
        i.radni_naziv,
        i.kontakt_ime,
        i.kontakt_tel,
        i.kontakt_email,
        i.napomena,
        i.status_id,
        s.naziv AS status_naziv,
        s.kod   AS status_kod,
        i.projekat_id,

        -- ✅ Deal “opened_at”: nema kolone u DB, pa koristimo created_at kao trenutak otvaranja deala
        i.created_at AS opened_at,

        -- ✅ OWNER SIGNAL dolazi sa projekta (ako postoji)
        p.operativni_signal

      FROM inicijacije i
      LEFT JOIN statusi s
        ON s.status_id = i.status_id
      LEFT JOIN projekti p
        ON p.projekat_id = i.projekat_id
      WHERE i.inicijacija_id = ?
      LIMIT 1
      `,
      [id]
    );

    const row = rows?.[0] ?? null;
    if (!row) {
      return NextResponse.json({ ok: false, error: "Deal nije pronađen." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška (GET /api/inicijacije/jedna)" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    const id = toInt(url.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ ok: false, error: "Nedostaje ili neispravan id." }, { status: 400 });
    }

    const body = await req.json();

    const narucilac_id = toInt(body?.narucilac_id);
    const status_id = toInt(body?.status_id);

    const radni_naziv = String(body?.radni_naziv ?? "").trim();
    const krajnji_klijent_id = body?.krajnji_klijent_id ? toInt(body.krajnji_klijent_id) : null;

    const kontakt_ime = body?.kontakt_ime ? String(body.kontakt_ime).trim() : null;
    const kontakt_tel = body?.kontakt_tel ? String(body.kontakt_tel).trim() : null;
    const kontakt_email = body?.kontakt_email ? String(body.kontakt_email).trim() : null;
    const napomena = body?.napomena !== undefined && body?.napomena !== null ? String(body.napomena) : null;

    if (!narucilac_id) {
      return NextResponse.json({ ok: false, error: "Naručilac je obavezan." }, { status: 400 });
    }
    if (!status_id) {
      return NextResponse.json({ ok: false, error: "Status je obavezan." }, { status: 400 });
    }
    if (!radni_naziv) {
      return NextResponse.json({ ok: false, error: "Radni naziv je obavezan." }, { status: 400 });
    }

    await query(
      `
      UPDATE inicijacije
      SET
        narucilac_id = ?,
        krajnji_klijent_id = ?,
        radni_naziv = ?,
        kontakt_ime = ?,
        kontakt_tel = ?,
        kontakt_email = ?,
        napomena = ?,
        status_id = ?,
        updated_at = NOW()
      WHERE inicijacija_id = ?
      LIMIT 1
      `,
      [
        narucilac_id,
        krajnji_klijent_id,
        radni_naziv,
        kontakt_ime,
        kontakt_tel,
        kontakt_email,
        napomena,
        status_id,
        id,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška (PUT /api/inicijacije/jedna)" },
      { status: 500 }
    );
  }
}
