import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const where: string[] = ["tal.aktivan = 1"];
    const joinConditions: string[] = ["t.entity_type = 'talent'", "t.entity_id = tal.talent_id"];
    const params: any[] = [];

    // Filter po datumu troška (datum_troska) - dodajemo u JOIN condition
    if (dateFrom) {
      joinConditions.push("(t.datum_troska IS NULL OR t.datum_troska >= ?)");
      params.push(dateFrom);
    }
    if (dateTo) {
      joinConditions.push("(t.datum_troska IS NULL OR t.datum_troska <= ?)");
      params.push(dateTo + " 23:59:59");
    }

    // Query za troškove po talentu i plaćanja
    const joinOnClause = joinConditions.join(" AND ");
    const whereClause = where.join(" AND ");
    
    const sql = 
      "SELECT " +
      "tal.talent_id, " +
      "tal.ime_prezime AS talent_naziv, " +
      "tal.vrsta AS talent_vrsta, " +
      "tal.email, " +
      "tal.telefon, " +
      "COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) AS ukupno_troskova, " +
      "COALESCE(SUM(CASE WHEN ps.stavka_id IS NOT NULL AND t.status <> 'STORNIRANO' THEN ps.iznos_km ELSE 0 END), 0) AS ukupno_placeno, " +
      "COUNT(DISTINCT t.projekat_id) AS broj_projekata, " +
      "COUNT(DISTINCT CASE WHEN t.status <> 'STORNIRANO' THEN t.trosak_id ELSE NULL END) AS broj_troskova " +
      "FROM talenti tal " +
      "LEFT JOIN projektni_troskovi t ON " + joinOnClause + " " +
      "LEFT JOIN placanja_stavke ps ON ps.trosak_id = t.trosak_id " +
      "WHERE " + whereClause + " " +
      "GROUP BY tal.talent_id, tal.ime_prezime, tal.vrsta, tal.email, tal.telefon " +
      "HAVING COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) > 0 " +
      "   OR COALESCE(SUM(CASE WHEN ps.stavka_id IS NOT NULL AND t.status <> 'STORNIRANO' THEN ps.iznos_km ELSE 0 END), 0) > 0 " +
      "ORDER BY COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) DESC, tal.ime_prezime ASC " +
      "LIMIT 500";

    const rows = await query(sql, params);

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const ukupnoTroskova = Number(r.ukupno_troskova) || 0;
      const ukupnoPlaceno = Number(r.ukupno_placeno) || 0;
      const stanje = ukupnoTroskova - ukupnoPlaceno;

      return {
        talent_id: r.talent_id,
        talent_naziv: r.talent_naziv || "—",
        talent_vrsta: r.talent_vrsta || "—",
        email: r.email || null,
        telefon: r.telefon || null,
        ukupno_troskova: ukupnoTroskova,
        ukupno_placeno: ukupnoPlaceno,
        stanje: stanje,
        broj_projekata: Number(r.broj_projekata) || 0,
        broj_troskova: Number(r.broj_troskova) || 0,
      };
    });

    const totalTroskova = items.reduce((s, i) => s + i.ukupno_troskova, 0);
    const totalPlaceno = items.reduce((s, i) => s + i.ukupno_placeno, 0);
    const totalStanje = totalTroskova - totalPlaceno;

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_talenta: items.length,
        ukupno_troskova: totalTroskova,
        ukupno_placeno: totalPlaceno,
        ukupno_stanje: totalStanje,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
