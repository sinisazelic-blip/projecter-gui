import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const where: string[] = ["(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))"];
    const params: any[] = [];

    // Filter po datumu izdavanja fakture
    if (dateFrom) {
      where.push("f.datum_izdavanja >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push("f.datum_izdavanja <= ?");
      params.push(dateTo + " 23:59:59");
    }

    // Query za fakture i naplate
    const rows = await query(
      `
      SELECT
        f.faktura_id,
        f.broj_fakture_puni AS broj_fakture,
        f.datum_izdavanja,
        DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(k.rok_placanja_dana, 30) DAY) AS datum_dospijeca,
        f.bill_to_klijent_id AS narucilac_id,
        k.naziv_klijenta AS narucilac_naziv,
        f.osnovica_km AS iznos_bez_pdv,
        f.pdv_iznos_km AS pdv_iznos,
        f.iznos_ukupno_km AS iznos_sa_pdv,
        f.valuta,
        CASE
          WHEN f.fiskalni_status IN ('PLACENA', 'DJELIMICNO') THEN f.iznos_ukupno_km
          ELSE 0
        END AS naplaceno,
        CASE
          WHEN f.fiskalni_status IN ('PLACENA', 'DJELIMICNO') THEN 0
          ELSE f.iznos_ukupno_km
        END AS neplaceno
      FROM fakture f
      LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
      WHERE ${where.join(" AND ")}
      ORDER BY f.datum_izdavanja DESC, f.faktura_id DESC
      LIMIT 1000
      `,
      params,
    );

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => {
      let brojFakture = r.broj_fakture;
      if (brojFakture && typeof brojFakture === "string") {
        const parts = brojFakture.split("/");
        if (parts.length === 2 && /^\d+$/.test(parts[0])) {
          brojFakture = `${String(Number(parts[0])).padStart(3, "0")}/${parts[1]}`;
        }
      }

      return {
        faktura_id: r.faktura_id,
        broj_fakture: brojFakture,
        datum_izdavanja: r.datum_izdavanja ? formatDateDMY(String(r.datum_izdavanja).slice(0, 10)) : null,
        datum_dospijeca: r.datum_dospijeca ? formatDateDMY(String(r.datum_dospijeca).slice(0, 10)) : null,
        narucilac_naziv: r.narucilac_naziv || "—",
        iznos_bez_pdv: Number(r.iznos_bez_pdv) || 0,
        pdv_iznos: Number(r.pdv_iznos) || 0,
        iznos_sa_pdv: Number(r.iznos_sa_pdv) || 0,
        valuta: r.valuta || "BAM",
        naplaceno: Number(r.naplaceno) || 0,
        neplaceno: Number(r.neplaceno) || 0,
      };
    });

    const ukupnoFakturisano = items.reduce((s, i) => s + i.iznos_sa_pdv, 0);
    const ukupnoNaplaceno = items.reduce((s, i) => s + i.naplaceno, 0);
    const ukupnoNeplaceno = items.reduce((s, i) => s + i.neplaceno, 0);
    const ukupnoBezPdv = items.reduce((s, i) => s + i.iznos_bez_pdv, 0);
    const ukupnoPdv = items.reduce((s, i) => s + i.pdv_iznos, 0);

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_faktura: items.length,
        ukupno_fakturisano: ukupnoFakturisano,
        ukupno_naplaceno: ukupnoNaplaceno,
        ukupno_neplaceno: ukupnoNeplaceno,
        ukupno_bez_pdv: ukupnoBezPdv,
        ukupno_pdv: ukupnoPdv,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
