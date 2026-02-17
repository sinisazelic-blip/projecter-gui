import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

const ARHIVA_CUTOFF = "2025-12-31";

type ArchiveRow = {
  broj_fakture: string;
  datum_fakture: string;
  klijent_id: number | null;
  iznos_km: number;
  ukupno_faktura?: number;
};

/**
 * Knjiga prihoda iz arhive: osnovica = iznos_km, PDV = ukupno_faktura − iznos_km (ako postoji kolona), inače 0.
 */
async function loadArchiveKnjiga(
  dateFrom: string | null,
  dateTo: string | null
): Promise<{ datum: string; broj_fakture: string; kupac: string; osnovica: number; pdv: number; ukupno: number; iz_arhive: true }[]> {
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

  let rows: ArchiveRow[] = [];
  try {
    rows = (await query(
      `SELECT broj_fakture, MAX(datum_fakture) AS datum_fakture,
              MAX(COALESCE(narucilac_id, krajnji_klijent_id)) AS klijent_id,
              ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km,
              ROUND(SUM(COALESCE(iznos_ukupno_km, iznos_sa_pdv_km, iznos_km)), 2) AS ukupno_faktura
       FROM stg_master_finansije
       WHERE ${conditions.join(" AND ")}
       GROUP BY broj_fakture
       ${havingSql}
       ORDER BY datum_fakture ASC, broj_fakture ASC
       LIMIT 10000`,
      params
    )) as ArchiveRow[];
  } catch {
    try {
      rows = (await query(
        `SELECT broj_fakture, MAX(datum_fakture) AS datum_fakture,
                MAX(COALESCE(narucilac_id, krajnji_klijent_id)) AS klijent_id,
                ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km
         FROM stg_master_finansije
         WHERE ${conditions.join(" AND ")}
         GROUP BY broj_fakture
         ${havingSql}
         ORDER BY datum_fakture ASC, broj_fakture ASC
         LIMIT 10000`,
        params
      )) as ArchiveRow[];
      rows = rows.map((r) => ({ ...r, ukupno_faktura: r.iznos_km }));
    } catch {
      return [];
    }
  }

  if (!rows?.length) return [];

  const klijentIds = [...new Set(rows.map((r) => r.klijent_id).filter(Boolean))] as number[];
  const placeholders = klijentIds.map(() => "?").join(",");
  const nameRows = (await query(
    `SELECT klijent_id, naziv_klijenta FROM klijenti WHERE klijent_id IN (${placeholders})`,
    klijentIds
  )) as { klijent_id: number; naziv_klijenta: string }[];
  const nazivById = new Map((nameRows ?? []).map((r) => [Number(r.klijent_id), r.naziv_klijenta ?? "—"]));

  return rows.map((r) => {
    const osnovica = Number(r.iznos_km) || 0;
    const ukupnoFaktura = Number(r.ukupno_faktura ?? r.iznos_km) || osnovica;
    const pdv = Math.max(0, ukupnoFaktura - osnovica);
    
    // Popravi datum koristeći godinu iz broja fakture ako datum ne odgovara
    let datumFakture = r.datum_fakture;
    const brojFakture = String(r.broj_fakture ?? "").trim();
    const godinaMatch = brojFakture.match(/[-/](\d{4})$/);
    if (godinaMatch && datumFakture) {
      const godinaIzBroja = parseInt(godinaMatch[1], 10);
      const datumStr = String(datumFakture).slice(0, 10);
      const godinaIzDatuma = new Date(datumStr).getFullYear();
      
      // Ako godine ne odgovaraju (razlika > 1 godinu), koristi godinu iz broja fakture
      if (Math.abs(godinaIzBroja - godinaIzDatuma) > 1) {
        // Konstruiši datum sa ispravnom godinom, zadržavajući mjesec i dan
        try {
          const datumObj = new Date(datumStr);
          datumObj.setFullYear(godinaIzBroja);
          // Provjeri da li je datum validan (npr. 29.2. u neprestupnoj godini)
          if (!isNaN(datumObj.getTime())) {
            datumFakture = datumObj.toISOString().slice(0, 10);
          } else {
            // Ako datum nije validan (npr. 29.2.), koristi 1.1. te godine
            datumFakture = `${godinaIzBroja}-01-01`;
          }
        } catch {
          // Fallback: koristi prvi dan godine iz broja fakture
          datumFakture = `${godinaIzBroja}-01-01`;
        }
      }
    }
    
    return {
      datum: datumFakture ? formatDateDMY(String(datumFakture).slice(0, 10)) : "—",
      broj_fakture: brojFakture || "—",
      kupac: (r.klijent_id != null ? nazivById.get(r.klijent_id) : null) ?? "—",
      osnovica,
      pdv,
      ukupno: ukupnoFaktura,
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
      LIMIT 10000
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
        iz_arhive: false,
      };
    });

    const archiveItems = await loadArchiveKnjiga(dateFrom, dateTo);
    for (const a of archiveItems) {
      items.push({
        datum: a.datum,
        broj_fakture: a.broj_fakture,
        kupac: a.kupac,
        osnovica: a.osnovica,
        pdv: a.pdv,
        ukupno: a.ukupno,
        valuta: "BAM",
        iz_arhive: true,
      });
    }

    items.sort((a, b) => {
      const dA = (a.datum ?? "").split(".").reverse().join("");
      const dB = (b.datum ?? "").split(".").reverse().join("");
      return dA.localeCompare(dB) || String(a.broj_fakture ?? "").localeCompare(String(b.broj_fakture ?? ""), "hr");
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
