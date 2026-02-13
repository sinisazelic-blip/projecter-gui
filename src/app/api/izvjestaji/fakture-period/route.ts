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

    if (dateFrom) {
      where.push("f.datum_izdavanja >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push("f.datum_izdavanja <= ?");
      params.push(dateTo);
    }

    const rows = await query(
      `
      SELECT
        f.faktura_id,
        f.broj_fakture_puni AS broj_fakture,
        f.datum_izdavanja,
        f.bill_to_klijent_id AS narucilac_id,
        k.naziv_klijenta AS narucilac_naziv,
        f.osnovica_km AS iznos_bez_pdv,
        f.pdv_iznos_km AS pdv_iznos,
        f.iznos_ukupno_km AS iznos_sa_pdv,
        f.valuta,
        f.fiskalni_status AS status
      FROM fakture f
      LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
      WHERE ${where.join(" AND ")}
      ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC
      LIMIT 2000
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
        narucilac_naziv: r.narucilac_naziv || "—",
        iznos_bez_pdv: Number(r.iznos_bez_pdv) || 0,
        pdv_iznos: Number(r.pdv_iznos) || 0,
        iznos_sa_pdv: Number(r.iznos_sa_pdv) || 0,
        valuta: r.valuta || "BAM",
        status: r.status,
      };
    });

    const ukupno_bez_pdv = items.reduce((s, i) => s + i.iznos_bez_pdv, 0);
    const ukupno_pdv = items.reduce((s, i) => s + i.pdv_iznos, 0);
    const ukupno_sa_pdv = items.reduce((s, i) => s + i.iznos_sa_pdv, 0);

    return NextResponse.json({
      ok: true,
      items,
      summary: { ukupno_bez_pdv, ukupno_pdv, ukupno_sa_pdv, broj_faktura: items.length },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
