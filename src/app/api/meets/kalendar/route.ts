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
        p.radni_naziv AS naziv_projekta,
        i.radni_naziv AS deal_naziv,
        f.faktura_id,
        CONCAT(f.godina, '-', f.broj_u_godini) AS broj_fakture
      FROM plivacki_kalendar k
      LEFT JOIN projekti p ON p.projekat_id = k.projekat_id
      LEFT JOIN inicijacije i ON i.inicijacija_id = k.inicijacija_id
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
      dnevna_tarifa_km = 500,
      honorar_nacin_placanja = "FAKTURA",
      nocenja_broj = 0,
      nocenje_pokriva = "BEZ_NOCENJA",
      nocenje_cijena_km = 0,
      kilometraza_km = 0,
      trosak_goriva_km = 0,
      putarine_km = 0,
      put_pokriva = "ORGANIZATOR_KES",
      dnevnice_mjerioca_km = 0,
      dnevnice_pokriva = "ORGANIZATOR",
      ugovoreni_pausal_km = 0,
      dodatni_kes_troskovi_km = 0,
      status = "PLANIRANO",
      napomena = null,
      kreiraj_deal = false,
      inicijacija_id = null,
      projekat_id = null,
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
    }

    // Stavke obračuna
    const honorarIznos = (Number(broj_takmicarskih_dana) || 1) * (Number(dnevna_tarifa_km) || 500);
    const putUkupno = (Number(trosak_goriva_km) || 0) + (Number(putarine_km) || 0);
    const smjestajUkupno = (Number(nocenja_broj) || 0) * (Number(nocenje_cijena_km) || 0);
    const dnevniceUkupno = Number(dnevnice_mjerioca_km) || 0;

    // 1. Iznos za žiralnu fakturu
    let fakturaSuma = honorar_nacin_placanja === "FAKTURA" ? honorarIznos : 0;
    if (put_pokriva === "ORGANIZATOR_FAKTURA") fakturaSuma += putUkupno;
    if (nocenje_pokriva === "ORGANIZATOR_FAKTURA") fakturaSuma += smjestajUkupno;
    if (dnevnice_pokriva === "ORGANIZATOR_FAKTURA") fakturaSuma += dnevniceUkupno;

    // 2. Iznos za naplatu na ruke (keš)
    let kesSuma = honorar_nacin_placanja === "KES" ? honorarIznos : 0;
    if (put_pokriva === "ORGANIZATOR_KES") kesSuma += putUkupno;
    if (nocenje_pokriva === "ORGANIZATOR_KES") kesSuma += smjestajUkupno;
    if (dnevnice_pokriva === "ORGANIZATOR_KES") kesSuma += dnevniceUkupno;

    // 3. Ukupno naplata od organizatora
    const finalPausal = Number(ugovoreni_pausal_km) > 0 ? Number(ugovoreni_pausal_km) : (fakturaSuma + kesSuma);

    // 4. Trošak koji pada na teret Studija TAF iz svog džepa
    let trosakStudija = 0;
    if (put_pokriva === "STUDIO_TAF") trosakStudija += putUkupno;
    if (nocenje_pokriva === "STUDIO_TAF") trosakStudija += smjestajUkupno;
    if (dnevnice_pokriva === "STUDIO_TAF") trosakStudija += dnevniceUkupno;

    // 5. Čista neto zarada Studija TAF
    const netoZarada = honorarIznos - trosakStudija;

    // Automatsko kreiranje Deala (inicijacije) ako je označeno
    let finalInicijacijaId = inicijacija_id ? Number(inicijacija_id) : null;
    if (kreiraj_deal && !finalInicijacijaId && klub_savez_id) {
      try {
        const deadlineStr = datum_od ? `${datum_od} 10:00:00` : null;
        const dealIznos = fakturaSuma > 0 ? fakturaSuma : finalPausal;
        const dealRes: any = await query(
          `INSERT INTO inicijacije (narucilac_id, radni_naziv, napomena, valuta, procijenjeni_iznos, status_id) VALUES (?, ?, ?, 'BAM', ?, 1)`,
          [
            Number(klub_savez_id),
            String(naziv_takmicenja).trim(),
            `Plivačko takmičenje (${lokacija_grad}) - Ukupno: ${finalPausal} KM (Faktura: ${fakturaSuma} KM, Keš: ${kesSuma} KM). Datum: ${datum_od}`,
            dealIznos,
          ],
        );
        finalInicijacijaId = dealRes?.insertId || null;

        if (finalInicijacijaId) {
          // 1. Postavi rok u timeline događaje
          if (deadlineStr) {
            await query(
              `INSERT INTO deal_timeline_events (inicijacija_id, required_deadline, accepted_deadline, note) VALUES (?, ?, ?, 'Datum održavanja takmičenja')`,
              [finalInicijacijaId, deadlineStr, deadlineStr],
            );
          }

          // 2. Postavi stavku budžeta sa cijenom paušala
          await query(
            `INSERT INTO inicijacija_stavke (inicijacija_id, naziv_snapshot, jedinica_snapshot, kolicina, cijena_jedinicna, valuta, opis, line_total) VALUES (?, ?, 'kom', 1, ?, 'BAM', ?, ?)`,
            [
              finalInicijacijaId,
              `Mjerenje vremena i obrada rezultata — ${String(naziv_takmicenja).trim()} (${broj_takmicarskih_dana} dana)`,
              dealIznos,
              `Lokacija: ${lokacija_grad} (${bazen_naziv || "Bazen"}). Termin: ${datum_od} - ${datum_do}`,
              dealIznos,
            ],
          );
        }
      } catch (err) {
        console.error("Greška pri automatskom kreiranju Deala:", err);
      }
    }

    const res: any = await query(
      `
      INSERT INTO plivacki_kalendar
      (godina, naziv_takmicenja, klub_savez_id, klub_savez_naziv, lokacija_grad, bazen_naziv,
       tip_lokacije, datum_od, datum_do, datum_polaska, datum_povratka, broj_takmicarskih_dana,
       dnevna_tarifa_km, honorar_nacin_placanja, ukupno_blokiranih_dana, nocenja_broj, nocenje_pokriva,
       nocenje_cijena_km, kilometraza_km, trosak_goriva_km, putarine_km, put_pokriva,
       dnevnice_mjerioca_km, dnevnice_pokriva, ugovoreni_pausal_km, iznos_faktura_km, iznos_kes_km,
       trosak_studija_km, dodatni_kes_troskovi_km, neto_zarada_km, status, napomena, projekat_id, inicijacija_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        Number(dnevna_tarifa_km) || 500,
        honorar_nacin_placanja,
        blokiranihDana,
        Number(nocenja_broj),
        nocenje_pokriva,
        Number(nocenje_cijena_km),
        Number(kilometraza_km),
        Number(trosak_goriva_km),
        Number(putarine_km),
        put_pokriva,
        Number(dnevnice_mjerioca_km),
        dnevnice_pokriva,
        finalPausal,
        fakturaSuma,
        kesSuma,
        trosakStudija,
        Number(dodatni_kes_troskovi_km) || 0,
        netoZarada,
        status,
        napomena ? String(napomena).trim() : null,
        projekat_id ? Number(projekat_id) : null,
        finalInicijacijaId,
      ],
    );

    return NextResponse.json({
      ok: true,
      kalendar_id: res?.insertId,
      inicijacija_id: finalInicijacijaId,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Greška" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { kalendar_id, kreiraj_deal, ...updates } = body;
    const id = Number(kalendar_id);
    if (!id) return NextResponse.json({ ok: false, error: "Nedostaje kalendar_id" }, { status: 400 });

    // Proračun stavki ako se mijenjaju parametri
    const bDana = Number(updates.broj_takmicarskih_dana) || 2;
    const tarifa = Number(updates.dnevna_tarifa_km) || 500;
    const honorarIznos = bDana * tarifa;
    const putUkupno = (Number(updates.trosak_goriva_km) || 0) + (Number(updates.putarine_km) || 0);
    const smjestajUkupno = (Number(updates.nocenja_broj) || 0) * (Number(updates.nocenje_cijena_km) || 0);
    const dnevniceUkupno = Number(updates.dnevnice_mjerioca_km) || 0;

    let fakturaSuma = updates.honorar_nacin_placanja === "FAKTURA" ? honorarIznos : 0;
    if (updates.put_pokriva === "ORGANIZATOR_FAKTURA") fakturaSuma += putUkupno;
    if (updates.nocenje_pokriva === "ORGANIZATOR_FAKTURA") fakturaSuma += smjestajUkupno;
    if (updates.dnevnice_pokriva === "ORGANIZATOR_FAKTURA") fakturaSuma += dnevniceUkupno;

    let kesSuma = updates.honorar_nacin_placanja === "KES" ? honorarIznos : 0;
    if (updates.put_pokriva === "ORGANIZATOR_KES") kesSuma += putUkupno;
    if (updates.nocenje_pokriva === "ORGANIZATOR_KES") kesSuma += smjestajUkupno;
    if (updates.dnevnice_pokriva === "ORGANIZATOR_KES") kesSuma += dnevniceUkupno;

    updates.iznos_faktura_km = fakturaSuma;
    updates.iznos_kes_km = kesSuma;
    updates.ugovoreni_pausal_km = Number(updates.ugovoreni_pausal_km) > 0 ? Number(updates.ugovoreni_pausal_km) : (fakturaSuma + kesSuma);

    let trosakStudija = 0;
    if (updates.put_pokriva === "STUDIO_TAF") trosakStudija += putUkupno;
    if (updates.nocenje_pokriva === "STUDIO_TAF") trosakStudija += smjestajUkupno;
    if (updates.dnevnice_pokriva === "STUDIO_TAF") trosakStudija += dnevniceUkupno;

    updates.trosak_studija_km = trosakStudija;
    updates.neto_zarada_km = honorarIznos - trosakStudija;

    // Ako korisnik želi da kreira Deal za postojeći kalendarski zapis
    if (kreiraj_deal && !updates.inicijacija_id && updates.klub_savez_id) {
      try {
        const deadlineStr = updates.datum_od ? `${updates.datum_od} 10:00:00` : null;
        const dealIznos = fakturaSuma > 0 ? fakturaSuma : updates.ugovoreni_pausal_km;
        const dealRes: any = await query(
          `INSERT INTO inicijacije (narucilac_id, radni_naziv, napomena, valuta, procijenjeni_iznos, status_id) VALUES (?, ?, ?, 'BAM', ?, 1)`,
          [
            Number(updates.klub_savez_id),
            String(updates.naziv_takmicenja || "Plivačko takmičenje").trim(),
            `Plivačko takmičenje (${updates.lokacija_grad || "Teren"}) - Ukupno: ${updates.ugovoreni_pausal_km} KM. Datum: ${updates.datum_od || ""}`,
            dealIznos,
          ],
        );
        updates.inicijacija_id = dealRes?.insertId || null;

        if (updates.inicijacija_id) {
          if (deadlineStr) {
            await query(
              `INSERT INTO deal_timeline_events (inicijacija_id, required_deadline, accepted_deadline, note) VALUES (?, ?, ?, 'Datum održavanja takmičenja')`,
              [updates.inicijacija_id, deadlineStr, deadlineStr],
            );
          }

          await query(
            `INSERT INTO inicijacija_stavke (inicijacija_id, naziv_snapshot, units_snapshot, kolicina, cijena_jedinicna, valuta, opis, line_total) VALUES (?, ?, 'kom', 1, ?, 'BAM', ?, ?)`,
            [
              updates.inicijacija_id,
              `Mjerenje vremena i obrada rezultata — ${String(updates.naziv_takmicenja || "Takmičenje").trim()}`,
              dealIznos,
              `Lokacija: ${updates.lokacija_grad || ""} (${updates.bazen_naziv || "Bazen"}). Termin: ${updates.datum_od || ""}`,
              dealIznos,
            ],
          );
        }
      } catch (err) {
        console.error("Greška pri kreiranju Deala u PATCH:", err);
      }
    }

    // Proračun blokiranih dana
    if (updates.broj_takmicarskih_dana || updates.tip_lokacije) {
      let bDana = Number(updates.broj_takmicarskih_dana) || 2;
      if (updates.tip_lokacije === "TEREN_DALEKO") bDana += 2;
      updates.ukupno_blokiranih_dana = bDana;
    }

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
      "dnevna_tarifa_km",
      "honorar_nacin_placanja",
      "ukupno_blokiranih_dana",
      "nocenja_broj",
      "nocenje_pokriva",
      "nocenje_cijena_km",
      "kilometraza_km",
      "trosak_goriva_km",
      "putarine_km",
      "put_pokriva",
      "dnevnice_mjerioca_km",
      "dnevnice_pokriva",
      "ugovoreni_pausal_km",
      "iznos_faktura_km",
      "iznos_kes_km",
      "trosak_studija_km",
      "dodatni_kes_troskovi_km",
      "neto_zarada_km",
      "status",
      "napomena",
      "projekat_id",
      "inicijacija_id",
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

    return NextResponse.json({ ok: true, inicijacija_id: updates.inicijacija_id });
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
