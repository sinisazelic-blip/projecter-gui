import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [racuni, planStavke, potrazivanjaRows] = await Promise.all([
      query(`
        SELECT id, naziv, opis, tip, saldo, valuta, sort_order, updated_at
        FROM owner_racuni_stanja
        ORDER BY sort_order ASC, id ASC
      `),
      query(`
        SELECT id, vrsta, kategorija, naziv, iznos, valuta, rok_datum, status, napomena, sort_order, created_at
        FROM owner_plan_stavke
        ORDER BY sort_order ASC, id ASC
      `),
      query(`
        SELECT 
          f.faktura_id,
          f.broj_fakture_puni AS broj_fakture,
          f.datum_izdavanja,
          k.naziv_klijenta AS klijent_naziv,
          f.iznos_ukupno_km AS iznos_sa_pdv,
          f.valuta
        FROM fakture f
        LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
        WHERE (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
          AND (f.status IS NULL OR f.status <> 'PLACENA')
        ORDER BY f.datum_izdavanja DESC
        LIMIT 15
      `).catch(() => []),
    ]);

    return NextResponse.json({
      ok: true,
      racuni: racuni || [],
      planStavke: planStavke || [],
      tafPotrazivanja: potrazivanjaRows || [],
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target } = body;

    if (target === "racun") {
      const { naziv, opis = "", tip = "PRIVATNI_RACUN", saldo = 0, valuta = "BAM" } = body;
      if (!naziv) {
        return NextResponse.json({ ok: false, error: "Naziv računa je obavezan." }, { status: 400 });
      }

      const res: any = await query(
        `INSERT INTO owner_racuni_stanja (naziv, opis, tip, saldo, valuta) VALUES (?, ?, ?, ?, ?)`,
        [naziv.trim(), opis.trim(), tip, Number(saldo) || 0, valuta]
      );
      return NextResponse.json({ ok: true, id: res.insertId });
    }

    // Standardna plan stavka
    const {
      vrsta = "RASHOD",
      kategorija = "OSTALO",
      naziv,
      iznos,
      valuta = "BAM",
      rok_datum,
      status = "PLANIRANO",
      napomena = "",
    } = body;

    if (!naziv || iznos === undefined || iznos === null) {
      return NextResponse.json({ ok: false, error: "Naziv i iznos su obavezni." }, { status: 400 });
    }

    const res: any = await query(
      `
      INSERT INTO owner_plan_stavke 
        (vrsta, kategorija, naziv, iznos, valuta, rok_datum, status, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        vrsta,
        kategorija,
        naziv.trim(),
        Number(iznos) || 0,
        valuta,
        rok_datum || null,
        status,
        napomena || null,
      ]
    );

    return NextResponse.json({ ok: true, id: res.insertId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, id } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    if (target === "racun") {
      const { naziv, opis, tip, saldo, valuta } = body;
      await query(
        `
        UPDATE owner_racuni_stanja SET
          naziv = COALESCE(?, naziv),
          opis = COALESCE(?, opis),
          tip = COALESCE(?, tip),
          saldo = COALESCE(?, saldo),
          valuta = COALESCE(?, valuta)
        WHERE id = ?
      `,
        [
          naziv,
          opis,
          tip,
          saldo !== undefined ? Number(saldo) : null,
          valuta,
          id,
        ]
      );
      return NextResponse.json({ ok: true });
    }

    // Plan stavka
    const { vrsta, kategorija, naziv, iznos, valuta, rok_datum, status, napomena } = body;
    await query(
      `
      UPDATE owner_plan_stavke SET
        vrsta = COALESCE(?, vrsta),
        kategorija = COALESCE(?, kategorija),
        naziv = COALESCE(?, naziv),
        iznos = COALESCE(?, iznos),
        valuta = COALESCE(?, valuta),
        rok_datum = COALESCE(?, rok_datum),
        status = COALESCE(?, status),
        napomena = COALESCE(?, napomena)
      WHERE id = ?
    `,
      [
        vrsta,
        kategorija,
        naziv,
        iznos !== undefined ? Number(iznos) : null,
        valuta,
        rok_datum,
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, id, action, value } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    if (target === "racun") {
      if (action === "update_saldo") {
        await query(`UPDATE owner_racuni_stanja SET saldo = ? WHERE id = ?`, [Number(value) || 0, id]);
        return NextResponse.json({ ok: true });
      }
    }

    if (action === "toggle_status") {
      // Toggle između PLANIRANO -> REALIZOVANO -> HOLD -> PLANIRANO
      const rows = (await query(`SELECT status FROM owner_plan_stavke WHERE id = ?`, [id])) as any[];
      const cur = rows?.[0]?.status || "PLANIRANO";
      let nextStatus = "PLANIRANO";
      if (cur === "PLANIRANO") nextStatus = "REALIZOVANO";
      else if (cur === "REALIZOVANO") nextStatus = "HOLD";
      else if (cur === "HOLD") nextStatus = "PLANIRANO";

      await query(`UPDATE owner_plan_stavke SET status = ? WHERE id = ?`, [nextStatus, id]);
      return NextResponse.json({ ok: true, status: nextStatus });
    }

    if (action === "set_status") {
      await query(`UPDATE owner_plan_stavke SET status = ? WHERE id = ?`, [value, id]);
      return NextResponse.json({ ok: true, status: value });
    }

    return NextResponse.json({ ok: false, error: "Nepoznata akcija." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const target = searchParams.get("target");

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    if (target === "racun") {
      await query(`DELETE FROM owner_racuni_stanja WHERE id = ?`, [Number(id)]);
    } else {
      await query(`DELETE FROM owner_plan_stavke WHERE id = ?`, [Number(id)]);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
