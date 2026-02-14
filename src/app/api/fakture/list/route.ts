// src/app/api/fakture/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const brojFakture = url.searchParams.get("broj_fakture")?.trim() || "";
    const narucilacId = url.searchParams.get("narucilac_id")
      ? Number(url.searchParams.get("narucilac_id"))
      : null;

    const params: any[] = [];
    const whereClauses: string[] = [];
    if (brojFakture) {
      whereClauses.push("f.broj_fakture_puni LIKE ?");
      params.push(`%${brojFakture}%`);
    }
    if (narucilacId && Number.isFinite(narucilacId)) {
      whereClauses.push("f.bill_to_klijent_id = ?");
      params.push(narucilacId);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Direktno iz tabele — podaci su u osnovica_km, pdv_iznos_km, iznos_ukupno_km
    const fakture = await query(
      `
      SELECT
        f.faktura_id,
        f.broj_fakture_puni AS broj_fakture,
        f.broj_fiskalni,
        f.datum_izdavanja,
        f.bill_to_klijent_id AS narucilac_id,
        k.naziv_klijenta AS narucilac_naziv,
        k.rok_placanja_dana,
        f.osnovica_km AS iznos_bez_pdv,
        f.pdv_iznos_km AS pdv_iznos,
        f.iznos_ukupno_km AS iznos_sa_pdv,
        f.valuta,
        f.fiskalni_status AS status,
        f.created_at
      FROM fakture f
      LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
      ${whereSql}
      ORDER BY f.created_at DESC, f.faktura_id DESC
      LIMIT 500
      `,
      params,
    );

    // Izračunaj datum dospijeća za svaku fakturu i formatiraj broj fakture
    const faktureSaDatumom = (Array.isArray(fakture) ? fakture : []).map((f: any) => {
      let datumDospijeca = null;
      if (f.datum_izdavanja && f.rok_placanja_dana) {
        const datum = new Date(f.datum_izdavanja);
        datum.setDate(datum.getDate() + Number(f.rok_placanja_dana));
        datumDospijeca = datum.toISOString().slice(0, 10);
      }
      
      // Formatiraj broj fakture ako je potrebno (npr. "5/2026" -> "005/2026")
      let brojFaktureFormatiran = f.broj_fakture;
      if (f.broj_fakture && typeof f.broj_fakture === "string") {
        const parts = f.broj_fakture.split("/");
        if (parts.length === 2) {
          const broj = parts[0];
          const godina = parts[1];
          if (/^\d+$/.test(broj) && /^\d{4}$/.test(godina)) {
            brojFaktureFormatiran = `${String(Number(broj)).padStart(3, "0")}/${godina}`;
          }
        }
      }
      
      return {
        ...f,
        broj_fakture: brojFaktureFormatiran,
        datum_dospijeca: datumDospijeca,
        status: f.status === "DODIJELJEN" ? "Fakturisan" : f.status,
        // MySQL DECIMAL dolazi kao string — osiguraj brojeve za prikaz
        iznos_bez_pdv: Number(f.iznos_bez_pdv) || 0,
        pdv_iznos: Number(f.pdv_iznos) || 0,
        iznos_sa_pdv: Number(f.iznos_sa_pdv) || 0,
      };
    });

    // Učitaj naručioca za filter dropdown
    let narucioci: any[] = [];
    try {
      narucioci = await query(
        `SELECT DISTINCT k.klijent_id, k.naziv_klijenta
         FROM fakture f
         JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
         ORDER BY k.naziv_klijenta ASC`,
      );
    } catch {
      try {
        narucioci = await query(
          `SELECT DISTINCT k.klijent_id, k.naziv_klijenta
           FROM fakture f
           JOIN klijenti k ON k.klijent_id = f.narucilac_id
           ORDER BY k.naziv_klijenta ASC`,
        );
      } catch {
        narucioci = [];
      }
    }

    return NextResponse.json({
      ok: true,
      fakture: faktureSaDatumom,
      narucioci: Array.isArray(narucioci) ? narucioci : [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška na serveru" },
      { status: 500 },
    );
  }
}
