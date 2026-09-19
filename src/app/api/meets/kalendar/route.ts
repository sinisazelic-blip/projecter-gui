import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("godina")) || new Date().getFullYear();

    const rows = await query(
      `
      SELECT
        k.*,
        p.naziv_projekta,
        f.faktura_id,
        f.broj_fakture,
        f.status_naplate AS faktura_status_naplate
      FROM plivacki_kalendar k
      LEFT JOIN projekti p ON p.projekat_id = k.projekat_id
      LEFT JOIN (
        SELECT fp.projekat_id, MAX(fak.faktura_id) AS faktura_id
        FROM faktura_projekti fp
        JOIN fakture fak ON fak.faktura_id = fp.faktura_id
        WHERE (fak.fiskalni_status IS NULL OR fak.fiskalni_status <> 'STORNIRAN')
        GROUP BY fp.projekat_id
      ) fp_link ON fp_link.projekat_id = k.projekat_id
      LEFT JOIN fakture f ON f.faktura_id = fp_link.faktura_id
      WHERE k.godina = ?
      ORDER BY k.datum_od ASC, k.kalendar_id ASC
      `,
      [year],
    );

    return NextResponse.json({ ok: true, rows: rows ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Greška" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      godina = new Date().getFullYear(),
      naziv_takmicenja,
      klub_savez_id = null,
      klub_savez_naziv = null,
      lokacija_grad = "Banja Luka",
      bazen_naziv = null,
      tip_lokacije = "DOMACI",
      datum_od,
      datum_do,
      datum_polaska = null,
      datum_povratka = null,
      broj_takmicarskih_dana = 2,
      nocenja_broj = 0,
      nocenje_pokriva = "BEZ_NOCENJA",
      nocenje_cijena_km = 0,
      kilometraza_km = 0,
      trosak_goriva_km = 0,
      putarine_km = 0,
      dnevnice_mjerioca_km = 0,
      ugovoreni_pausal_km = 0,
      status = "PLANIRANO",
      napomena = null,
    } = body;

    if (!naziv_takmicenja || !datum_od || !datum_do) {
      return NextResponse.json(
        { ok: false, error: "Naziv takmičenja i datumi (od/do) su obavezni." },
        { status: 400 },
      );
    }

    // Automatski proračun blokiranih dana
    let blokiranihDana = Number(broj_takmicarskih_dana) || 2;
    if (tip_lokacije === "TEREN_DALEKO") {
      blokiranihDana += 2; // +1 dan pripreme i puta prije, +1 dan odmora i povratka poslije
    } else if (tip_lokacije === "TEREN_BLIZU") {
      blokiranihDana += 0;
    }

    // Automatski proračun troškova
    const smjestajTrosak =
      nocenje_pokriva === "STUDIO_TAF" ? Number(nocenja_broj) * Number(nocenje_cijena_km) : 0;
    const ukupniTroskovi =
      smjestajTrosak +
      Number(trosak_goriva_km) +
      Number(putarine_km) +
      Number(dnevnice_mjerioca_km);

    const netoZarada = Number(ugovoreni_pausal_km) - ukupniTroskovi;

    const res: any = await query(
      `
      INSERT INTO plivacki_kalendar
      (godina, naziv_takmicenja, klub_savez_id, klub_savez_naziv, lokacija_grad, bazen_naziv,
       tip_lokacije, datum_od, datum_do, datum_polaska, datum_povratka, broj_takmicarskih_dana,
       ukupno_blokiranih_dana, nocenja_broj, nocenje_pokriva, nocenje_cijena_km, kilometraza_km,
       trosak_goriva_km, putarine_km, dnevnice_mjerioca_km, ugovoreni_pausal_km, neto_zarada_km,
       status, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        Number(godina),
        String(naziv_takmicenja).trim(),
        klub_savez_id ? Number(klub_savez_id) : null,
        klub_savez_naziv ? String(klub_savez_naziv).trim() : null,
        String(lokacija_grad).trim(),
        bazen_naziv ? String(bazen_naziv).trim() : null,
        tip_lokacije,
        datum_od,
        datum_do,
        datum_polaska || null,
        datum_povratka || null,
        Number(broj_takmicarskih_dana),
        blokiranihDana,
        Number(nocenja_broj),
        nocenje_pokriva,
        Number(nocenje_cijena_km),
        Number(kilometraza_km),
        Number(trosak_goriva_km),
        Number(putarine_km),
        Number(dnevnice_mjerioca_km),
        Number(ugovoreni_pausal_km),
        netoZarada,
        status,
        napomena ? String(napomena).trim() : null,
      ],
    );

    return NextResponse.json({ ok: true, kalendar_id: res?.insertId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Greška" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { kalendar_id, ...updates } = body;
    const id = Number(kalendar_id);
    if (!id) return NextResponse.json({ ok: false, error: "Nedostaje kalendar_id" }, { status: 400 });

    const fields: string[] = [];
    const params: any[] = [];

    const allowed = [
      "naziv_takmicenja",
      "klub_savez_id",
      "klub_savez_naziv",
      "lokacija_grad",
      "bazen_naziv",
      "tip_lokacije",
      "datum_od",
      "datum_do",
      "datum_polaska",
      "datum_povratka",
      "broj_takmicarskih_dana",
      "ukupno_blokiranih_dana",
      "nocenja_broj",
      "nocenje_pokriva",
      "nocenje_cijena_km",
      "kilometraza_km",
      "trosak_goriva_km",
      "putarine_km",
      "dnevnice_mjerioca_km",
      "ugovoreni_pausal_km",
      "neto_zarada_km",
      "status",
      "napomena",
      "projekat_id",
    ];

    for (const key of allowed) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }

    if (!fields.length) {
      return NextResponse.json({ ok: false, error: "Nema polja za ažuriranje" }, { status: 400 });
    }

    params.push(id);
    await query(`UPDATE plivacki_kalendar SET ${fields.join(", ")} WHERE kalendar_id = ?`, params);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Greška" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return NextResponse.json({ ok: false, error: "Nedostaje id" }, { status: 400 });

    await query("DELETE FROM plivacki_kalendar WHERE kalendar_id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Greška" }, { status: 500 });
  }
}
