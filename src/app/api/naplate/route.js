import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);

    // ✅ NOVO: projekat filter
    const projekatIdRaw = url.searchParams.get("projekat_id");

    // filteri
    const onlyLate = url.searchParams.get("only_late") === "1";
    const fakt = url.searchParams.get("fakturisano"); // "1" | "0" | null
    const narIdRaw = url.searchParams.get("narucilac_id");
    const dueFrom = url.searchParams.get("due_from"); // YYYY-MM-DD
    const dueTo = url.searchParams.get("due_to"); // YYYY-MM-DD

    // default: pokaži stvari koje dospijevaju uskoro (npr. 14 dana) ili kasne
    const upcomingDaysRaw = url.searchParams.get("upcoming_days");
    const upcomingDays = upcomingDaysRaw ? Number(upcomingDaysRaw) : 14;

    const where = [];
    const args = [];

    // Naplate: oslanjamo se na fakture, ne na status projekta.
    // status_id projekta je često van sync-a sa stvarnim stanjem faktura.

    // izostavi stornirane/zamijenjene fakture
    where.push("(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))");

    // ✅ NOVO: projekat filter (ako je došao u URL-u)
    if (projekatIdRaw && Number.isFinite(Number(projekatIdRaw))) {
      where.push("fp.projekat_id = ?");
      args.push(Number(projekatIdRaw));
    }

    // only late
    if (onlyLate) {
      where.push("f.datum_dospijeca < CURDATE()");
    }

    // fakturisano filter (sve su fakturisane jer su status_id = 9)
    // Ne treba filter jer sve su fakturisane

    // naručilac filter
    if (narIdRaw && Number.isFinite(Number(narIdRaw))) {
      where.push("f.bill_to_klijent_id = ?");
      args.push(Number(narIdRaw));
    }

    // valuta range filter
    if (dueFrom) {
      where.push("f.datum_dospijeca >= ?");
      args.push(dueFrom);
    }
    if (dueTo) {
      where.push("f.datum_dospijeca <= ?");
      args.push(dueTo);
    }

    // upcoming window (kad nije onlyLate i nije eksplicitno postavljen range)
    if (!onlyLate && !dueFrom && !dueTo && Number.isFinite(upcomingDays)) {
      where.push("f.datum_dospijeca <= DATE_ADD(CURDATE(), INTERVAL ? DAY)");
      args.push(Math.max(0, Math.floor(upcomingDays)));
    }

    // ✅ Direktno uzmi podatke iz fakture tabele za fakturisane fakture
    // Umjesto view-a vw_naplate, direktno uzimamo iz faktura_projekti -> fakture -> projekti
    // Datum dospijeća se računa dinamički: datum_izdavanja + rok_placanja_dana
    const sql = `
      SELECT 
        fp.projekat_id,
        p.radni_naziv,
        p.narucilac_id,
        kn.naziv_klijenta AS narucilac_naziv,
        p.krajnji_klijent_id,
        kk.naziv_klijenta AS krajnji_klijent_naziv,
        f.faktura_id,
        COALESCE(f.broj_fakture_puni, CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina)) AS broj_fakture,
        f.datum_izdavanja,
        -- Izračunaj datum dospijeća: datum_izdavanja + rok_placanja_dana (ili 30 dana ako nije definisan)
        DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) AS datum_valute,
        f.iznos_ukupno_km AS iznos,
        f.valuta,
        f.fiskalni_status AS faktura_status,
        CASE
          WHEN f.fiskalni_status IN ('PLACENA', 'DJELIMICNO') THEN f.iznos_ukupno_km
          ELSE 0
        END AS naplaceno,
        CASE
          WHEN f.fiskalni_status IN ('PLACENA', 'DJELIMICNO') THEN 0
          ELSE f.iznos_ukupno_km
        END AS neplaceno,
        -- Izračunaj dane do valute ili dane kašnjenja
        CASE
          WHEN f.datum_izdavanja IS NULL THEN NULL
          WHEN DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) < CURDATE() THEN NULL
          ELSE DATEDIFF(DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY), CURDATE())
        END AS dana_do_valute,
        CASE
          WHEN f.datum_izdavanja IS NULL THEN NULL
          WHEN DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) < CURDATE() 
            THEN DATEDIFF(CURDATE(), DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY))
          ELSE NULL
        END AS dana_kasni,
        CASE
          WHEN f.datum_izdavanja IS NULL THEN 'bez_valute'
          WHEN DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) < CURDATE() THEN 'kasni'
          ELSE 'ceka'
        END AS naplata_status,
        1 AS fakturisano,
        NULL AS placeno_datum
      FROM faktura_projekti fp
      JOIN projekti p ON p.projekat_id = fp.projekat_id
      JOIN fakture f ON f.faktura_id = fp.faktura_id
      LEFT JOIN klijenti kn ON kn.klijent_id = f.bill_to_klijent_id
      LEFT JOIN klijenti kk ON kk.klijent_id = p.krajnji_klijent_id
      ${where.length ? "WHERE " + where.map(w => {
        // Mapiranje filtera - zamijeni reference na datum_dospijeca sa DATE_ADD izračunom
        return w
          .replace(/f\.datum_dospijeca/g, "DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY)");
      }).join(" AND ") : ""}
      ORDER BY
        CASE 
          WHEN DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) < CURDATE() 
            THEN DATEDIFF(CURDATE(), DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY))
          ELSE 0 
        END DESC,
        DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) ASC,
        fp.projekat_id DESC
      LIMIT 500;
    `;

    const rows = await query(sql, args);

    return NextResponse.json({ ok: true, success: true, data: rows });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: e?.message || String(e),
        code: e?.code,
      },
      { status: 500 },
    );
  }
}
