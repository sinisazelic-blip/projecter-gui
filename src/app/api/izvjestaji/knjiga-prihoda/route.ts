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
        k.naziv_klijenta AS kupac,
        f.osnovica_km AS osnovica,
        f.pdv_iznos_km AS pdv,
        f.iznos_ukupno_km AS ukupno,
        f.valuta
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
        datum: r.datum_izdavanja ? formatDateDMY(String(r.datum_izdavanja).slice(0, 10)) : null,
        broj_fakture: brojFakture,
        kupac: r.kupac || "—",
        osnovica: Number(r.osnovica) || 0,
        pdv: Number(r.pdv) || 0,
        ukupno: Number(r.ukupno) || 0,
        valuta: r.valuta || "BAM",
      };
    });

    const ukupno_osnovica = items.reduce((s, i) => s + i.osnovica, 0);
    const ukupno_pdv = items.reduce((s, i) => s + i.pdv, 0);
    const ukupno_sve = items.reduce((s, i) => s + i.ukupno, 0);

    return NextResponse.json({
      ok: true,
      items,
      summary: { ukupno_osnovica, ukupno_pdv, ukupno_sve, broj_stavki: items.length },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
