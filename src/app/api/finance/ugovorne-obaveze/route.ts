import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trosakId = Number(searchParams.get("trosak_id") || 20); // default Knjigovodstvo id=20
    const godina = Number(searchParams.get("godina") || new Date().getFullYear());

    // Osiguraj da imamo generisano 12 mjeseci za ovu godinu
    for (let m = 1; m <= 12; m++) {
      await query(
        `
        INSERT IGNORE INTO ugovorne_obaveze_mjeseci (trosak_id, godina, mjesec, iznos_km, status)
        VALUES (?, ?, ?, 150.00, 'NEPLACENO')
      `,
        [trosakId, godina, m]
      );
    }

    const rows = await query(
      `
      SELECT 
        u.id, u.trosak_id, u.godina, u.mjesec, u.iznos_km, 
        u.status, u.datum_placanja, u.bank_transaction_id, u.napomena,
        f.naziv_troska
      FROM ugovorne_obaveze_mjeseci u
      JOIN fiksni_troskovi f ON f.trosak_id = u.trosak_id
      WHERE u.trosak_id = ? AND u.godina = ?
      ORDER BY u.mjesec ASC
    `,
      [trosakId, godina]
    );

    // Izračunaj statistiku
    const months = Array.isArray(rows) ? rows : [];
    const placeni = months.filter((m: any) => m.status === "PLACENO");
    const neplaceni = months.filter((m: any) => m.status !== "PLACENO");
    const zadnjiPlaceniMjesec = placeni.length > 0 ? Math.max(...placeni.map((m: any) => m.mjesec)) : 0;
    const ukupnoPlacenoKm = placeni.reduce((sum: number, m: any) => sum + Number(m.iznos_km || 0), 0);
    const preostaloZaGodinuKm = neplaceni.reduce((sum: number, m: any) => sum + Number(m.iznos_km || 0), 0);

    return NextResponse.json({
      ok: true,
      trosakId,
      godina,
      months,
      stats: {
        ukupnoMjeseci: 12,
        placenoMjeseci: placeni.length,
        preostaloMjeseci: neplaceni.length,
        zadnjiPlaceniMjesec,
        ukupnoPlacenoKm,
        preostaloZaGodinuKm,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/finance/ugovorne-obaveze
 * Automatska FIFO alokacija uplate (npr. 600 KM) za zatvaranje najstarijih neplaćenih mjeseci
 * body: { trosak_id: number, uplata_km: number, datum_uplate: string, bank_tx_id?: number, napomena?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      trosak_id = 20,
      uplata_km,
      datum_uplate = new Date().toISOString().slice(0, 10),
      bank_tx_id = null,
      napomena = "",
    } = body;

    const uplata = Number(uplata_km);
    if (!uplata || uplata <= 0) {
      return NextResponse.json({ ok: false, error: "Iznos uplate mora biti pozitivan broj." }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();

    // Nađi neplaćene mjesece sortirane po godini i mjesecu uzlazno (FIFO)
    const unpaid: any = await query(
      `
      SELECT id, godina, mjesec, iznos_km
      FROM ugovorne_obaveze_mjeseci
      WHERE trosak_id = ? AND status != 'PLACENO'
      ORDER BY godina ASC, mjesec ASC
    `,
      [trosak_id]
    );

    let remainingUplata = uplata;
    const closedMonths = [];

    for (const m of unpaid || []) {
      const iznosMjeseca = Number(m.iznos_km);
      if (remainingUplata >= iznosMjeseca) {
        // Zatvori cijeli mjesec
        await query(
          `
          UPDATE ugovorne_obaveze_mjeseci SET
            status = 'PLACENO',
            datum_placanja = ?,
            bank_transaction_id = ?,
            napomena = ?
          WHERE id = ?
        `,
          [
            datum_uplate,
            bank_tx_id,
            napomena || `Zatvoreno uplatom ${uplata} KM (${datum_uplate})`,
            m.id,
          ]
        );
        remainingUplata -= iznosMjeseca;
        closedMonths.push(`${m.mjesec}/${m.godina}`);
      } else {
        break;
      }
    }

    // Ažuriraj i zadnje_placeno u fiksni_troskovi
    await query(`UPDATE fiksni_troskovi SET zadnje_placeno = ? WHERE trosak_id = ?`, [datum_uplate, trosak_id]);

    return NextResponse.json({
      ok: true,
      message: `Uspješno raspoređena uplata od ${uplata} KM. Zatvoreno mjeseci: ${closedMonths.length} (${closedMonths.join(", ")})`,
      closedMonths,
      remainingUnallocated: remainingUplata,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
