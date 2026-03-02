import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

const ARHIVA_CUTOFF = "2025-12-31";

type ArchiveRow = { broj_fakture: string; datum_fakture: string; klijent_id: number | null; iznos_km: number };

/**
 * Fakture iz stg_master_finansije do 31.12.2025 — agregirano po broj_fakture + datum_fakture.
 * Iznos ide u Ukupno sa PDV i u Naplaćeno (istorija zatvorena).
 */
async function loadArchiveFaktureNaplate(
  dateFrom: string | null,
  dateTo: string | null
): Promise<{ broj_fakture: string; datum_izdavanja: string; datum_dospijeca: string | null; narucilac_naziv: string; iznos_sa_pdv: number; naplaceno: number; neplaceno: number; iz_arhive: true }[]> {
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
  try {
    const rows = (await query(
      `SELECT broj_fakture, MAX(datum_fakture) AS datum_fakture,
              MAX(COALESCE(narucilac_id, krajnji_klijent_id)) AS klijent_id,
              ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km
       FROM stg_master_finansije
       WHERE ${conditions.join(" AND ")}
       GROUP BY broj_fakture
       ${havingSql}
       ORDER BY datum_fakture DESC, broj_fakture DESC
       LIMIT 10000`,
      params
    )) as ArchiveRow[];

    if (!rows?.length) return [];

    const klijentIds = [...new Set(rows.map((r) => r.klijent_id).filter(Boolean))] as number[];
    const placeholders = klijentIds.map(() => "?").join(",");
    const nameRows = (await query(
      `SELECT klijent_id, naziv_klijenta FROM klijenti WHERE klijent_id IN (${placeholders})`,
      klijentIds
    )) as { klijent_id: number; naziv_klijenta: string }[];
    const nazivById = new Map((nameRows ?? []).map((r) => [Number(r.klijent_id), r.naziv_klijenta ?? "—"]));

    return rows.map((r) => {
      const iznos = Number(r.iznos_km) || 0;
      
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
        broj_fakture: brojFakture || "—",
        datum_izdavanja: datumFakture ? formatDateDMY(datumFakture) : "—",
        datum_dospijeca: datumFakture ? formatDateDMY(datumFakture) : null,
        narucilac_naziv: (r.klijent_id != null ? nazivById.get(r.klijent_id) : null) ?? "—",
        iznos_sa_pdv: iznos,
        naplaceno: iznos,
        neplaceno: 0,
        iz_arhive: true as const,
      };
    });
  } catch {
    return [];
  }
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
      params.push(dateTo + " 23:59:59");
    }

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
      LIMIT 5000
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
        datum_izdavanja: r.datum_izdavanja ? formatDateDMY(r.datum_izdavanja) : null,
        datum_dospijeca: r.datum_dospijeca ? formatDateDMY(r.datum_dospijeca) : null,
        narucilac_naziv: r.narucilac_naziv || "—",
        iznos_bez_pdv: Number(r.iznos_bez_pdv) || 0,
        pdv_iznos: Number(r.pdv_iznos) || 0,
        iznos_sa_pdv: Number(r.iznos_sa_pdv) || 0,
        valuta: r.valuta || "BAM",
        naplaceno: Number(r.naplaceno) || 0,
        neplaceno: Number(r.neplaceno) || 0,
        iz_arhive: false,
      };
    });

    const archiveItems = await loadArchiveFaktureNaplate(dateFrom, dateTo);
    for (const a of archiveItems) {
      items.push({
        faktura_id: null,
        broj_fakture: a.broj_fakture,
        datum_izdavanja: a.datum_izdavanja,
        datum_dospijeca: a.datum_dospijeca,
        narucilac_naziv: a.narucilac_naziv,
        iznos_bez_pdv: a.iznos_sa_pdv,
        pdv_iznos: 0,
        iznos_sa_pdv: a.iznos_sa_pdv,
        valuta: "BAM",
        naplaceno: a.naplaceno,
        neplaceno: a.neplaceno,
        iz_arhive: true,
      });
    }

    items.sort((a, b) => {
      const dA = (a.datum_izdavanja ?? "").split(".").reverse().join("");
      const dB = (b.datum_izdavanja ?? "").split(".").reverse().join("");
      if (dB !== dA) return dB.localeCompare(dA);
      return String(b.broj_fakture ?? "").localeCompare(String(a.broj_fakture ?? ""), "hr");
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
