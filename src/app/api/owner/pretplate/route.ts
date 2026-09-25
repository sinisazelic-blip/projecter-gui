import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { insertCashDraftDb } from "@/lib/cash/db";

export const dynamic = "force-dynamic";

function getFxRateToBAM(currency: string): number {
  const c = String(currency || "BAM").toUpperCase();
  if (c === "EUR") return 1.95583;
  if (c === "USD") return 1.80;
  return 1.0;
}

export async function GET() {
  try {
    const rows = await query(`
      SELECT 
        id, naziv, kategorija, iznos, valuta, frekvencija,
        dan_u_mjesecu, mjesec_u_godini, nacin_placanja, status, napomena, DATE_FORMAT(zadnje_placeno, '%Y-%m-%d') AS zadnje_placeno, created_at
      FROM owner_privatne_pretplate
      ORDER BY (status = 'AKTIVAN') DESC, frekvencija ASC, dan_u_mjesecu ASC, naziv ASC
    `);
    return NextResponse.json({ ok: true, items: rows || [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      naziv,
      kategorija = "SOFTWARE",
      iznos,
      valuta = "USD",
      frekvencija = "MJESECNO",
      dan_u_mjesecu = 1,
      mjesec_u_godini = null,
      nacin_placanja = "Privatna kartica",
      status = "AKTIVAN",
      napomena = "",
    } = body;

    if (!naziv || iznos === undefined || iznos === null) {
      return NextResponse.json({ ok: false, error: "Naziv i iznos su obavezni." }, { status: 400 });
    }

    const res: any = await query(
      `
      INSERT INTO owner_privatne_pretplate 
        (naziv, kategorija, iznos, valuta, frekvencija, dan_u_mjesecu, mjesec_u_godini, nacin_placanja, status, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        naziv.trim(),
        kategorija,
        Number(iznos),
        valuta,
        frekvencija,
        Number(dan_u_mjesecu) || 1,
        mjesec_u_godini ? Number(mjesec_u_godini) : null,
        nacin_placanja,
        status,
        napomena || null,
      ]
    );

    return NextResponse.json({ ok: true, id: res.insertId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    const rows = (await query(`SELECT * FROM owner_privatne_pretplate WHERE id = ?`, [id])) as any[];
    const item = rows?.[0];
    if (!item) {
      return NextResponse.json({ ok: false, error: "Pretplata nije pronađena." }, { status: 404 });
    }

    if (action === "pay") {
      // 1. Ažuriraj zadnje_placeno na danas
      const today = new Date().toISOString().slice(0, 10);
      await query(`UPDATE owner_privatne_pretplate SET zadnje_placeno = ? WHERE id = ?`, [today, id]);

      // 2. Izračunaj protivvrijednost u BAM i evidentiraj izlaz (OUT) u privatnoj blagajni
      const fx = getFxRateToBAM(item.valuta);
      const iznosOriginal = Number(item.iznos) || 0;
      const iznosBAM = Math.round(iznosOriginal * fx * 100) / 100;

      await insertCashDraftDb({
        date: today,
        amount: iznosBAM,
        currency: "KM",
        direction: "OUT",
        note: `Pretplata: ${item.naziv} (${iznosOriginal} ${item.valuta})`,
        transactionDetails: `Privatna pretplata ${item.naziv} plaćena iz privatne gotovine/blagajne`,
      });

      return NextResponse.json({ ok: true, iznosBAM, date: today });
    }

    if (action === "toggle_status") {
      const newStatus = item.status === "AKTIVAN" ? "OTKAZANO" : "AKTIVAN";
      await query(`UPDATE owner_privatne_pretplate SET status = ? WHERE id = ?`, [newStatus, id]);
      return NextResponse.json({ ok: true, status: newStatus });
    }

    return NextResponse.json({ ok: false, error: "Nepoznata akcija." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

function toMysqlDateOnly(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      naziv,
      kategorija,
      iznos,
      valuta,
      frekvencija,
      dan_u_mjesecu,
      mjesec_u_godini,
      nacin_placanja,
      status,
      napomena,
      zadnje_placeno,
    } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    const safeZadnjePlaceno = zadnje_placeno !== undefined ? toMysqlDateOnly(zadnje_placeno) : undefined;

    await query(
      `
      UPDATE owner_privatne_pretplate SET
        naziv = COALESCE(?, naziv),
        kategorija = COALESCE(?, kategorija),
        iznos = COALESCE(?, iznos),
        valuta = COALESCE(?, valuta),
        frekvencija = COALESCE(?, frekvencija),
        dan_u_mjesecu = COALESCE(?, dan_u_mjesecu),
        mjesec_u_godini = COALESCE(?, mjesec_u_godini),
        nacin_placanja = COALESCE(?, nacin_placanja),
        status = COALESCE(?, status),
        napomena = COALESCE(?, napomena),
        zadnje_placeno = COALESCE(?, zadnje_placeno)
      WHERE id = ?
    `,
      [
        naziv,
        kategorija,
        iznos !== undefined ? Number(iznos) : null,
        valuta,
        frekvencija,
        dan_u_mjesecu !== undefined ? Number(dan_u_mjesecu) : null,
        mjesec_u_godini !== undefined ? (mjesec_u_godini ? Number(mjesec_u_godini) : null) : null,
        nacin_placanja,
        status,
        napomena,
        safeZadnjePlaceno,
        id,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }
    await query(`DELETE FROM owner_privatne_pretplate WHERE id = ?`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
