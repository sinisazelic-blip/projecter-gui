import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

const ARHIVA_CUTOFF = "2025-12-31";
const LIST_LIMIT = 10000;

type ArchivePdvRow = {
  broj_fakture: string;
  datum_fakture: string;
  iznos_km: number;
  ukupno_faktura?: number;
};

/**
 * PDV iz arhive (stg_master_finansije): osnovica = iznos_km, izlazni PDV = ukupno_faktura − iznos_km (ako postoji kolona).
 */
async function loadArchivePdv(
  dateFrom: string | null,
  dateTo: string | null
): Promise<{ datum: string; osnovica: number; pdv_izlazni: number; iz_arhive: true }[]> {
  const conditions: string[] = ["datum_fakture IS NOT NULL", "datum_fakture <= ?"];
  const params: any[] = [ARHIVA_CUTOFF];
  const having: string[] = [];
  if (dateFrom) {
    having.push("MAX(datum_fakture) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    having.push("MAX(datum_fakture) <= ?");
    params.push(dateTo);
  }
  const havingSql = having.length ? ` HAVING ${having.join(" AND ")}` : "";

  let rows: ArchivePdvRow[] = [];
  try {
    rows = (await query(
      `SELECT broj_fakture, MAX(datum_fakture) AS datum_fakture,
              ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km,
              ROUND(SUM(COALESCE(iznos_ukupno_km, iznos_sa_pdv_km, iznos_km)), 2) AS ukupno_faktura
       FROM stg_master_finansije
       WHERE ${conditions.join(" AND ")}
       GROUP BY broj_fakture
       ${havingSql}
       ORDER BY datum_fakture ASC, broj_fakture ASC
       LIMIT ${LIST_LIMIT}`,
      params
    )) as ArchivePdvRow[];
  } catch {
    try {
      rows = (await query(
        `SELECT broj_fakture, MAX(datum_fakture) AS datum_fakture,
                ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km
         FROM stg_master_finansije
         WHERE ${conditions.join(" AND ")}
         GROUP BY broj_fakture
         ${havingSql}
         ORDER BY datum_fakture ASC, broj_fakture ASC
         LIMIT ${LIST_LIMIT}`,
        params
      )) as ArchivePdvRow[];
      rows = rows.map((r) => ({ ...r, ukupno_faktura: r.iznos_km }));
    } catch {
      return [];
    }
  }

  return rows.map((r) => {
    const osnovica = Number(r.iznos_km) || 0;
    const ukupnoFaktura = Number(r.ukupno_faktura ?? r.iznos_km) || osnovica;
    const pdv_izlazni = Math.max(0, ukupnoFaktura - osnovica);
    
    // Popravi datum koristeći godinu iz broja fakture ako datum ne odgovara
    let datumFakture = r.datum_fakture;
    const brojFakture = String(r.broj_fakture ?? "").trim();
    const godinaMatch = brojFakture.match(/[-/](\d{4})$/);
    if (godinaMatch && datumFakture) {
      const godinaIzBroja = parseInt(godinaMatch[1], 10);
      const datumStr = String(datumFakture).slice(0, 10);
      const godinaIzDatuma = new Date(datumStr).getFullYear();
      
      if (Math.abs(godinaIzBroja - godinaIzDatuma) > 1) {
        try {
          const datumObj = new Date(datumStr);
          datumObj.setFullYear(godinaIzBroja);
          if (!isNaN(datumObj.getTime())) {
            datumFakture = datumObj.toISOString().slice(0, 10);
          } else {
            datumFakture = `${godinaIzBroja}-01-01`;
          }
        } catch {
          datumFakture = `${godinaIzBroja}-01-01`;
        }
      }
    }
    
    return {
      datum: datumFakture ? formatDateDMY(datumFakture) : "—",
      osnovica,
      pdv_izlazni,
      iz_arhive: true as const,
    };
  });
}

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
      LIMIT ${LIST_LIMIT}
      `,
      params,
    );

    const stavke = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      datum: r.datum_izdavanja ? formatDateDMY(r.datum_izdavanja) : null,
      pdv_izlazni: Number(r.pdv_izlazni) || 0,
      osnovica: Number(r.osnovica) || 0,
      iz_arhive: false,
    }));

    const archiveItems = await loadArchivePdv(dateFrom, dateTo);
    for (const a of archiveItems) {
      stavke.push({
        datum: a.datum,
        osnovica: a.osnovica,
        pdv_izlazni: a.pdv_izlazni,
        iz_arhive: true,
      });
    }

    stavke.sort((a, b) => {
      const dA = (a.datum ?? "").split(".").reverse().join("");
      const dB = (b.datum ?? "").split(".").reverse().join("");
      return dA.localeCompare(dB);
    });

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
