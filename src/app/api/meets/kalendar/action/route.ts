import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, kalendar_id, iznos, datum, napomena } = body;
    const id = Number(kalendar_id);

    if (!id) {
      return NextResponse.json({ ok: false, error: "Nedostaje kalendar_id" }, { status: 400 });
    }

    // 1. Učitaj takmičenje
    const rows: any = await query("SELECT * FROM plivacki_kalendar WHERE kalendar_id = ? LIMIT 1", [id]);
    const meet = rows?.[0];
    if (!meet) {
      return NextResponse.json({ ok: false, error: "Takmičenje nije pronađeno." }, { status: 404 });
    }

    if (action === "SPREMI_ZA_FAKTURISANJE") {
      let projekatId = meet.projekat_id ? Number(meet.projekat_id) : null;
      const fakturniIznos = Number(meet.iznos_faktura_km) > 0 ? Number(meet.iznos_faktura_km) : (Number(meet.ugovoreni_pausal_km) || 0);

      // Ako projekat još ne postoji, kreiraj ga sa statusom 8 (Zatvoren / Spreman za fakturisanje)
      if (!projekatId) {
        if (!meet.klub_savez_id) {
          return NextResponse.json(
            { ok: false, error: "Morate odabrati Naručioca (Klub/Savez) da bi se kreirala faktura." },
            { status: 400 },
          );
        }

        const projRes: any = await query(
          `
          INSERT INTO projekti
          (radni_naziv, naziv_za_fakturu, narucilac_id, status_id, budzet_km, datum_pocetka, datum_zavrsetka, napomena)
          VALUES (?, ?, ?, 8, ?, ?, ?, ?)
          `,
          [
            meet.naziv_takmicenja,
            meet.naziv_takmicenja,
            meet.klub_savez_id,
            fakturniIznos,
            meet.datum_od,
            meet.datum_do,
            meet.napomena || `Plivačko takmičenje - ${meet.lokacija_grad}`,
          ],
        );
        projekatId = projRes.insertId;

        // Kreiraj stavku projekta za fakturisanje
        await query(
          `
          INSERT INTO projekat_stavke
          (projekat_id, naziv, opis, kolicina, cijena_jedinicna, valuta, line_total)
          VALUES (?, ?, ?, 1, ?, 'BAM', ?)
          `,
          [
            projekatId,
            `Mjerenje vremena i obrada rezultata — ${meet.naziv_takmicenja}`,
            `Lokacija: ${meet.lokacija_grad} (${meet.bazen_naziv || "Bazen"}). Termin: ${meet.datum_od}`,
            fakturniIznos,
            fakturniIznos,
          ],
        );

        // Upiši audit za zatvaranje da ga query /api/fakture/za-fakturisanje odmah vidi
        try {
          await query(
            `
            INSERT INTO project_audit (projekat_id, action, details)
            VALUES (?, 'PROJECT_CLOSE', 'Spremno za avansno/redovno fakturisanje iz plivačkog kalendara')
            `,
            [projekatId],
          );
        } catch (e) {
          console.warn("Audit insert warning:", e);
        }
      } else {
        // Ako već postoji projekat, osiguraj da mu je status 8 (Zatvoren / Spreman za fakturisanje)
        await query("UPDATE projekti SET status_id = 8, budzet_km = ? WHERE projekat_id = ?", [fakturniIznos, projekatId]);
      }

      // Ažuriraj kalendar
      await query(
        "UPDATE plivacki_kalendar SET projekat_id = ?, status = 'FAKTURISANO' WHERE kalendar_id = ?",
        [projekatId, id],
      );

      return NextResponse.json({
        ok: true,
        projekat_id: projekatId,
        redirect_url: `/fakture/wizard?narucilac_id=${meet.klub_savez_id}&projekat_id=${projekatId}`,
        message: `Takmičenje "${meet.naziv_takmicenja}" (${fakturniIznos.toFixed(2)} KM) je spremno za fakturisanje!`,
      });
    }

    if (action === "EVIDENTIRAJ_KES") {
      const uplataIznos = Number(iznos) || (Number(meet.iznos_kes_km) > 0 ? Number(meet.iznos_kes_km) : Number(meet.ugovoreni_pausal_km)) || 0;
      const datumUplate = datum || meet.datum_do || new Date().toISOString().slice(0, 10);
      const opisUplate =
        napomena ||
        `Keš uplata na bazenu: ${meet.naziv_takmicenja} (${meet.klub_savez_naziv || meet.lokacija_grad})`;

      if (uplataIznos <= 0) {
        return NextResponse.json(
          { ok: false, error: "Iznos keš uplate mora biti veći od 0 KM." },
          { status: 400 },
        );
      }

      // Upis u blagajna_stavke
      const cashRes: any = await query(
        `
        INSERT INTO blagajna_stavke
        (datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id, transaction_details, status)
        VALUES (?, ?, 'BAM', 'IN', ?, ?, 'plivacki_kalendar', ?, ?, 'AKTIVAN')
        `,
        [
          datumUplate,
          uplataIznos,
          opisUplate,
          meet.projekat_id || null,
          id,
          `PLIVACKO_TAKMICENJE_KES_${id}`,
        ],
      );

      // Ažuriraj kalendar status na NAPLACENO
      await query(
        "UPDATE plivacki_kalendar SET status = 'NAPLACENO', napomena = CONCAT(COALESCE(napomena, ''), ' [Plaćeno u kešu: ', ?, ' KM]') WHERE kalendar_id = ?",
        [uplataIznos, id],
      );

      return NextResponse.json({
        ok: true,
        blagajna_id: cashRes?.insertId,
        message: `✅ Keš uplata od ${uplataIznos.toFixed(2)} KM je uspješno evidentirana u gotovinsku blagajnu!`,
      });
    }

    return NextResponse.json({ ok: false, error: "Nepoznata akcija." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Greška" }, { status: 500 });
  }
}
