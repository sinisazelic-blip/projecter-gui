import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const where: string[] = [];
    const params: any[] = [];

    // Filter po datumu troška
    if (dateFrom) {
      where.push("t.datum_troska >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push("t.datum_troska <= ?");
      params.push(dateTo + " 23:59:59");
    }

    // Filtriranje troškova banke - po opisu
    // Pretpostavljamo da se troškovi banke mogu identifikovati po opisu koji sadrži riječi vezane za banku
    const bankFilterParts: string[] = [];
    const bankKeywords = [
      "PROVIZIJA",
      "ODRŽAVANJE",
      "ODRZAVANJE",
      "SWIFT",
      "BANKA",
      "BANK",
      "MAINTENANCE",
      "FEE",
      "NAKNADA",
      "NAKNADE",
    ];

    for (const kw of bankKeywords) {
      bankFilterParts.push(`UPPER(COALESCE(t.opis, '')) LIKE '%${kw}%'`);
    }

    where.push("(" + bankFilterParts.join(" OR ") + ")");

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    // Query za troškove banke grupirane po tipu
    const sql = 
      "SELECT " +
      "t.trosak_id, " +
      "t.datum_troska, " +
      "t.opis, " +
      "tt.naziv AS tip_naziv, " +
      "COALESCE(tt.naziv, 'OSTALO') AS tip_troska, " +
      "t.iznos_km, " +
      "t.valuta_original, " +
      "p.projekat_id, " +
      "p.radni_naziv AS projekat_naziv " +
      "FROM projektni_troskovi t " +
      "LEFT JOIN trosak_tipovi tt ON tt.tip_id = t.tip_id " +
      "LEFT JOIN projekti p ON p.projekat_id = t.projekat_id " +
      whereClause + " " +
      "AND t.status <> 'STORNIRANO' " +
      "ORDER BY t.datum_troska DESC, t.trosak_id DESC " +
      "LIMIT 2000";

    const rows = await query(sql, params);

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const tip = String(r.tip_troska || "OSTALO").toUpperCase();
      return {
        trosak_id: r.trosak_id,
        datum_troska: r.datum_troska ? formatDateDMY(String(r.datum_troska).slice(0, 10)) : null,
        opis: r.opis || "—",
        kategorija: r.tip_naziv || null,
        tip_naziv: r.tip_naziv || null,
        tip_troska: tip,
        iznos_km: Number(r.iznos_km) || 0,
        valuta_original: r.valuta_original || "BAM",
        projekat_id: r.projekat_id || null,
        projekat_naziv: r.projekat_naziv || null,
      };
    });

    // Grupiši po tipu za summary
    const groupedByType: Record<string, any[]> = {};
    for (const item of items) {
      const tip = item.tip_troska;
      if (!groupedByType[tip]) {
        groupedByType[tip] = [];
      }
      groupedByType[tip].push(item);
    }

    // Izračunaj ukupno
    const ukupnoTroskova = items.reduce((sum, i) => sum + i.iznos_km, 0);

    const ukupnoPoTipu: Record<string, number> = {};
    for (const [tip, tipItems] of Object.entries(groupedByType)) {
      ukupnoPoTipu[tip] = tipItems.reduce((sum, item) => sum + item.iznos_km, 0);
    }

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        ukupno_troskova: ukupnoTroskova,
        broj_stavki: items.length,
        po_tipu: ukupnoPoTipu,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
