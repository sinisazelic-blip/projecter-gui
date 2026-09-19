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
        id, naziv, banka, ukupan_iznos, iznos_rate, valuta,
        broj_rata, uplaceno_rata, dan_u_mjesecu, datum_pocetka,
        datum_kraja, status, napomena, created_at
      FROM owner_privatni_krediti
      ORDER BY (status = 'AKTIVAN') DESC, dan_u_mjesecu ASC, naziv ASC
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
      banka = "",
      ukupan_iznos = 0,
      iznos_rate,
      valuta = "BAM",
      broj_rata = 12,
      uplaceno_rata = 0,
      dan_u_mjesecu = 20,
      datum_pocetka,
      datum_kraja,
      status = "AKTIVAN",
      napomena = "",
    } = body;

    if (!naziv || iznos_rate === undefined || iznos_rate === null) {
      return NextResponse.json({ ok: false, error: "Naziv i iznos rate su obavezni." }, { status: 400 });
    }

    const res: any = await query(
      `
      INSERT INTO owner_privatni_krediti 
        (naziv, banka, ukupan_iznos, iznos_rate, valuta, broj_rata, uplaceno_rata, dan_u_mjesecu, datum_pocetka, datum_kraja, status, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        naziv.trim(),
        banka,
        Number(ukupan_iznos) || 0,
        Number(iznos_rate),
        valuta,
        Number(broj_rata) || 12,
        Number(uplaceno_rata) || 0,
        Number(dan_u_mjesecu) || 20,
        datum_pocetka || null,
        datum_kraja || null,
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

    const rows = (await query(`SELECT * FROM owner_privatni_krediti WHERE id = ?`, [id])) as any[];
    const kredit = rows?.[0];
    if (!kredit) {
      return NextResponse.json({ ok: false, error: "Kredit nije pronađen." }, { status: 404 });
    }

    if (action === "pay_installment") {
      const currentUplaceno = Number(kredit.uplaceno_rata) || 0;
      const ukupanBrojRata = Number(kredit.broj_rata) || 1;
      const newUplaceno = currentUplaceno + 1;
      const newStatus = newUplaceno >= ukupanBrojRata ? "OTPLACENO" : kredit.status;

      // 1. Ažuriraj broj uplaćenih rata
      await query(
        `UPDATE owner_privatni_krediti SET uplaceno_rata = ?, status = ? WHERE id = ?`,
        [newUplaceno, newStatus, id]
      );

      // 2. Izračunaj protivvrijednost rate u BAM i evidentiraj izlaz (OUT) u privatnoj blagajni
      const today = new Date().toISOString().slice(0, 10);
      const fx = getFxRateToBAM(kredit.valuta);
      const iznosOriginal = Number(kredit.iznos_rate) || 0;
      const iznosBAM = Math.round(iznosOriginal * fx * 100) / 100;

      await insertCashDraftDb({
        date: today,
        amount: iznosBAM,
        currency: "KM",
        direction: "OUT",
        note: `Rata kredita: ${kredit.naziv} (Rata ${newUplaceno}/${ukupanBrojRata})`,
        transactionDetails: `Privatni potrošački kredit ${kredit.naziv} - Rata ${newUplaceno} od ${ukupanBrojRata} plaćena iz privatne blagajne`,
      });

      return NextResponse.json({
        ok: true,
        uplaceno_rata: newUplaceno,
        broj_rata: ukupanBrojRata,
        status: newStatus,
        iznosBAM,
        date: today,
      });
    }

    if (action === "toggle_status") {
      const newStatus = kredit.status === "AKTIVAN" ? "PAUZIRANO" : "AKTIVAN";
      await query(`UPDATE owner_privatni_krediti SET status = ? WHERE id = ?`, [newStatus, id]);
      return NextResponse.json({ ok: true, status: newStatus });
    }

    return NextResponse.json({ ok: false, error: "Nepoznata akcija." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      naziv,
      banka,
      ukupan_iznos,
      iznos_rate,
      valuta,
      broj_rata,
      uplaceno_rata,
      dan_u_mjesecu,
      datum_pocetka,
      datum_kraja,
      status,
      napomena,
    } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    await query(
      `
      UPDATE owner_privatni_krediti SET
        naziv = COALESCE(?, naziv),
        banka = COALESCE(?, banka),
        ukupan_iznos = COALESCE(?, ukupan_iznos),
        iznos_rate = COALESCE(?, iznos_rate),
        valuta = COALESCE(?, valuta),
        broj_rata = COALESCE(?, broj_rata),
        uplaceno_rata = COALESCE(?, uplaceno_rata),
        dan_u_mjesecu = COALESCE(?, dan_u_mjesecu),
        datum_pocetka = COALESCE(?, datum_pocetka),
        datum_kraja = COALESCE(?, datum_kraja),
        status = COALESCE(?, status),
        napomena = COALESCE(?, napomena)
      WHERE id = ?
    `,
      [
        naziv,
        banka,
        ukupan_iznos !== undefined ? Number(ukupan_iznos) : null,
        iznos_rate !== undefined ? Number(iznos_rate) : null,
        valuta,
        broj_rata !== undefined ? Number(broj_rata) : null,
        uplaceno_rata !== undefined ? Number(uplaceno_rata) : null,
        dan_u_mjesecu !== undefined ? Number(dan_u_mjesecu) : null,
        datum_pocetka,
        datum_kraja,
        status,
        napomena,
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
    await query(`DELETE FROM owner_privatni_krediti WHERE id = ?`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
