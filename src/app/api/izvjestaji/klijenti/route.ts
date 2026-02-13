import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const dateFilterProjekti: string[] = [];
    const dateFilterFakture: string[] = [];
    const params: any[] = [];

    // Filter po datumu projekta
    if (dateFrom) {
      dateFilterProjekti.push("p.rok_glavni >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      dateFilterProjekti.push("p.rok_glavni <= ?");
      params.push(dateTo + " 23:59:59");
    }

    // Filter po datumu fakture
    if (dateFrom) {
      dateFilterFakture.push("f.datum_izdavanja >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      dateFilterFakture.push("f.datum_izdavanja <= ?");
      params.push(dateTo + " 23:59:59");
    }

    const projektiWhere = dateFilterProjekti.length ? "WHERE " + dateFilterProjekti.join(" AND ") : "";
    const faktureWhere = dateFilterFakture.length ? "WHERE " + dateFilterFakture.join(" AND ") : "";
    
    // Ako nema filtera, koristimo prazan string, ali pazimo da WHERE ne bude na kraju
    const projektiWhereClause = projektiWhere || "";
    const faktureWhereClause = faktureWhere || "";

    // Query za klijente sa projektima i fakturama koristeći subquery-je
    const sql = 
      "SELECT " +
      "k.klijent_id, " +
      "k.naziv_klijenta, " +
      "COALESCE(proj_stats.broj_projekata, 0) AS broj_projekata, " +
      "COALESCE(proj_stats.ukupno_budzet, 0) AS ukupno_budzet_projekata, " +
      "COALESCE(fakt_stats.broj_faktura, 0) AS broj_faktura, " +
      "COALESCE(fakt_stats.ukupno_fakturisano, 0) AS ukupno_fakturisano, " +
      "COALESCE(fakt_stats.ukupno_naplaceno, 0) AS ukupno_naplaceno, " +
      "COALESCE(fakt_stats.potrazivanja, 0) AS potrazivanja " +
      "FROM klijenti k " +
      "LEFT JOIN ( " +
      "  SELECT " +
      "    p.narucilac_id, " +
      "    COUNT(DISTINCT p.projekat_id) AS broj_projekata, " +
      "    COALESCE(SUM(COALESCE(vf.budzet_planirani, p.budzet_planirani, 0)), 0) AS ukupno_budzet " +
      "  FROM projekti p " +
      "  LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id " +
      projektiWhereClause + " " +
      "  GROUP BY p.narucilac_id " +
      ") proj_stats ON proj_stats.narucilac_id = k.klijent_id " +
      "LEFT JOIN ( " +
      "  SELECT " +
      "    f.bill_to_klijent_id, " +
      "    COUNT(DISTINCT f.faktura_id) AS broj_faktura, " +
      "    COALESCE(SUM(CASE WHEN f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN') THEN f.iznos_ukupno_km ELSE 0 END), 0) AS ukupno_fakturisano, " +
      "    COALESCE(SUM(CASE WHEN f.fiskalni_status IN ('PLACENA', 'DJELIMICNO') THEN f.iznos_ukupno_km ELSE 0 END), 0) AS ukupno_naplaceno, " +
      "    COALESCE(SUM(CASE WHEN f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('PLACENA', 'DJELIMICNO', 'STORNIRAN', 'ZAMIJENJEN') THEN f.iznos_ukupno_km ELSE 0 END), 0) AS potrazivanja " +
      "  FROM fakture f " +
      faktureWhereClause + " " +
      "  GROUP BY f.bill_to_klijent_id " +
      ") fakt_stats ON fakt_stats.bill_to_klijent_id = k.klijent_id " +
      "WHERE proj_stats.broj_projekata > 0 OR fakt_stats.broj_faktura > 0 " +
      "ORDER BY ukupno_fakturisano DESC, k.naziv_klijenta ASC " +
      "LIMIT 500";

    const rows = await query(sql, params);

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const brojProjekata = Number(r.broj_projekata) || 0;
      const ukupnoBudzetProjekata = Number(r.ukupno_budzet_projekata) || 0;
      const brojFaktura = Number(r.broj_faktura) || 0;
      const ukupnoFakturisano = Number(r.ukupno_fakturisano) || 0;
      const ukupnoNaplaceno = Number(r.ukupno_naplaceno) || 0;
      const potrazivanja = Number(r.potrazivanja) || 0;

      return {
        klijent_id: r.klijent_id,
        naziv_klijenta: r.naziv_klijenta || "—",
        broj_projekata: brojProjekata,
        ukupno_budzet_projekata: ukupnoBudzetProjekata,
        broj_faktura: brojFaktura,
        ukupno_fakturisano: ukupnoFakturisano,
        ukupno_naplaceno: ukupnoNaplaceno,
        potrazivanja: potrazivanja,
      };
    });

    const totalBrojProjekata = items.reduce((s, i) => s + i.broj_projekata, 0);
    const totalBudzetProjekata = items.reduce((s, i) => s + i.ukupno_budzet_projekata, 0);
    const totalBrojFaktura = items.reduce((s, i) => s + i.broj_faktura, 0);
    const totalFakturisano = items.reduce((s, i) => s + i.ukupno_fakturisano, 0);
    const totalNaplaceno = items.reduce((s, i) => s + i.ukupno_naplaceno, 0);
    const totalPotrazivanja = items.reduce((s, i) => s + i.potrazivanja, 0);

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_klijenata: items.length,
        ukupno_broj_projekata: totalBrojProjekata,
        ukupno_budzet_projekata: totalBudzetProjekata,
        ukupno_broj_faktura: totalBrojFaktura,
        ukupno_fakturisano: totalFakturisano,
        ukupno_naplaceno: totalNaplaceno,
        ukupno_potrazivanja: totalPotrazivanja,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
