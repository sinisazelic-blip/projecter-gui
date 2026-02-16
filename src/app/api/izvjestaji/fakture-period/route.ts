import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

const ARHIVA_CUTOFF = "2025-12-31";

type ArchiveInvoiceRow = { broj_fakture: string; datum_fakture: string; klijent_id: number | null; iznos_km: number };

/**
 * Lista izdatih faktura iz arhive (stg_master_finansije), agregirano po broj_fakture + datum_fakture.
 */
async function loadArchiveInvoices(
  dateFrom: string | null,
  dateTo: string | null
): Promise<{ broj_fakture: string; datum_izdavanja: string; narucilac_naziv: string; iznos_sa_pdv: number; iz_arhive: true }[]> {
  const conditions: string[] = ["datum_fakture IS NOT NULL", "datum_fakture <= ?"];
  const params: any[] = [ARHIVA_CUTOFF];
  if (dateFrom) {
    conditions.push("datum_fakture >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("datum_fakture <= ?");
    params.push(dateTo);
  }
  try {
    const rows = (await query(
      `SELECT broj_fakture, datum_fakture,
              MAX(COALESCE(narucilac_id, krajnji_klijent_id)) AS klijent_id,
              ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS iznos_km
       FROM stg_master_finansije
       WHERE ${conditions.join(" AND ")}
       GROUP BY broj_fakture, datum_fakture
       ORDER BY datum_fakture ASC, broj_fakture ASC
       LIMIT 2000`,
      params
    )) as ArchiveInvoiceRow[];

    if (!rows?.length) return [];

    const klijentIds = [...new Set((rows as ArchiveInvoiceRow[]).map((r) => r.klijent_id).filter(Boolean))] as number[];
    const placeholders = klijentIds.map(() => "?").join(",");
    const nameRows = (await query(
      `SELECT klijent_id, naziv_klijenta FROM klijenti WHERE klijent_id IN (${placeholders})`,
      klijentIds
    )) as { klijent_id: number; naziv_klijenta: string }[];
    const nazivById = new Map((nameRows ?? []).map((r) => [Number(r.klijent_id), r.naziv_klijenta ?? "—"]));

    return (rows as ArchiveInvoiceRow[]).map((r) => ({
      broj_fakture: String(r.broj_fakture ?? "").trim() || "—",
      datum_izdavanja: r.datum_fakture ? formatDateDMY(String(r.datum_fakture).slice(0, 10)) : "—",
      narucilac_naziv: (r.klijent_id != null ? nazivById.get(r.klijent_id) : null) ?? "—",
      iznos_sa_pdv: Number(r.iznos_km) || 0,
      iz_arhive: true as const,
    }));
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
        iz_arhive: false,
      };
    });

    const archiveItems = await loadArchiveInvoices(dateFrom, dateTo);
    for (const a of archiveItems) {
      items.push({
        faktura_id: null,
        broj_fakture: a.broj_fakture,
        datum_izdavanja: a.datum_izdavanja,
        narucilac_naziv: a.narucilac_naziv,
        iznos_bez_pdv: a.iznos_sa_pdv,
        pdv_iznos: 0,
        iznos_sa_pdv: a.iznos_sa_pdv,
        valuta: "BAM",
        status: null,
        iz_arhive: true,
      });
    }

    items.sort((a, b) => {
      const dA = (a.datum_izdavanja ?? "").split(".").reverse().join("");
      const dB = (b.datum_izdavanja ?? "").split(".").reverse().join("");
      if (dA !== dB) return dA.localeCompare(dB);
      return String(a.broj_fakture ?? "").localeCompare(String(b.broj_fakture ?? ""), "hr");
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
