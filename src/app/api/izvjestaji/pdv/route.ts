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
        f.datum_izdavanja,
        f.pdv_iznos_km AS pdv_izlazni,
        f.osnovica_km AS osnovica
      FROM fakture f
      WHERE ${where.join(" AND ")}
      ORDER BY f.datum_izdavanja ASC
      `,
      params,
    );

    const stavke = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      datum: r.datum_izdavanja ? formatDateDMY(String(r.datum_izdavanja).slice(0, 10)) : null,
      pdv_izlazni: Number(r.pdv_izlazni) || 0,
      osnovica: Number(r.osnovica) || 0,
    }));

    const pdv_izlazni_ukupno = stavke.reduce((s, i) => s + i.pdv_izlazni, 0);
    const osnovica_ukupno = stavke.reduce((s, i) => s + i.osnovica, 0);

    return NextResponse.json({
      ok: true,
      items: stavke,
      summary: {
        pdv_izlazni_ukupno,
        osnovica_ukupno,
        pdv_ulazni_ukupno: 0,
        napomena: "PDV ulazni (iz ulaznih računa) će biti dostupan kada se unose ulazni računi.",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
