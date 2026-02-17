import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ARHIVA_CUTOFF = "2025-12-31";

type LegacyClientRow = {
  klijent_id: number;
  stg_broj_projekata: number;
  stg_ukupno_fakturisano: number;
  stg_budzet: number;
  stg_naplaceno: number;
};

/**
 * Arhiva iz stg_master_finansije do 31.12.2025 — po klijentu: broj projekata, fakturisano, budžet i naplaćeno (iznos_km).
 * Naplaćeno iz istorije: nema tabela naplate, ali ~99,5% je naplaćeno — za historijski pregled iznos_km ide i u "naplaćeno".
 */
async function loadLegacyByClient(): Promise<
  Map<number, { broj_projekata: number; ukupno_fakturisano: number; budzet: number; naplaceno: number }>
> {
  const map = new Map<
    number,
    { broj_projekata: number; ukupno_fakturisano: number; budzet: number; naplaceno: number }
  >();
  try {
    const rows = (await query(
      `SELECT
        COALESCE(narucilac_id, krajnji_klijent_id) AS klijent_id,
        COUNT(DISTINCT id_po) AS stg_broj_projekata,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS stg_ukupno_fakturisano,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS stg_budzet,
        ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS stg_naplaceno
       FROM stg_master_finansije
       WHERE datum_zavrsetka IS NOT NULL AND datum_zavrsetka <= ?
         AND (narucilac_id IS NOT NULL OR krajnji_klijent_id IS NOT NULL)
       GROUP BY COALESCE(narucilac_id, krajnji_klijent_id)`,
      [ARHIVA_CUTOFF]
    )) as LegacyClientRow[];
    for (const r of rows ?? []) {
      const id = Number(r.klijent_id);
      if (!Number.isFinite(id)) continue;
      map.set(id, {
        broj_projekata: Number(r.stg_broj_projekata) || 0,
        ukupno_fakturisano: Number(r.stg_ukupno_fakturisano) || 0,
        budzet: Number(r.stg_budzet) || 0,
        naplaceno: Number(r.stg_naplaceno) || 0,
      });
    }
  } catch {
    // Tabela ili kolone ne postoje
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const dateFilterProjekti: string[] = [];
    const dateFilterFakture: string[] = [];
    const params: any[] = [];

    if (dateFrom) {
      dateFilterProjekti.push("p.rok_glavni >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      dateFilterProjekti.push("p.rok_glavni <= ?");
      params.push(dateTo + " 23:59:59");
    }
    if (dateFrom) {
      dateFilterFakture.push("f.datum_izdavanja >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      dateFilterFakture.push("f.datum_izdavanja <= ?");
      params.push(dateTo + " 23:59:59");
    }

    const projektiWhere = dateFilterProjekti.length ? "WHERE " + dateFilterProjekti.join(" AND ") : "";
    const faktureWhere = dateFilterFakture.length ? "WHERE " + dateFilterFakture.join(" AND ") : "";
    const projektiWhereClause = projektiWhere || "";
    const faktureWhereClause = faktureWhere || "";

    const sql =
      "SELECT " +
      "k.klijent_id, " +
      "k.naziv_klijenta, " +
      "COALESCE(proj_stats.broj_projekata, 0) AS broj_projekata, " +
      "COALESCE(proj_stats.ukupno_budzet, 0) AS ukupno_budzet_projekata, " +
      "COALESCE(fakt_stats.broj_faktura, 0) AS broj_faktura, " +
      "COALESCE(fakt_stats.ukupno_fakturisano, 0) AS ukupno_fakturisano, " +
      "COALESCE(fakt_stats.ukupno_naplaceno, 0) AS ukupno_naplaceno, " +
      "COALESCE(fakt_stats.potrazivanja, 0) AS potrazivanja " +
      "FROM klijenti k " +
      "LEFT JOIN ( " +
      "  SELECT " +
      "    p.narucilac_id, " +
      "    COUNT(DISTINCT p.projekat_id) AS broj_projekata, " +
      "    COALESCE(SUM(COALESCE(vf.budzet_planirani, p.budzet_planirani, 0)), 0) AS ukupno_budzet " +
      "  FROM projekti p " +
      "  LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id " +
      projektiWhereClause +
      " " +
      "  GROUP BY p.narucilac_id " +
      ") proj_stats ON proj_stats.narucilac_id = k.klijent_id " +
      "LEFT JOIN ( " +
      "  SELECT " +
      "    f.bill_to_klijent_id, " +
      "    COUNT(DISTINCT f.faktura_id) AS broj_faktura, " +
      "    COALESCE(SUM(CASE WHEN f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN') THEN f.iznos_ukupno_km ELSE 0 END), 0) AS ukupno_fakturisano, " +
      "    COALESCE(SUM(CASE WHEN f.fiskalni_status IN ('PLACENA', 'DJELIMICNO') THEN f.iznos_ukupno_km ELSE 0 END), 0) AS ukupno_naplaceno, " +
      "    COALESCE(SUM(CASE WHEN f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('PLACENA', 'DJELIMICNO', 'STORNIRAN', 'ZAMIJENJEN') THEN f.iznos_ukupno_km ELSE 0 END), 0) AS potrazivanja " +
      "  FROM fakture f " +
      faktureWhereClause +
      " " +
      "  GROUP BY f.bill_to_klijent_id " +
      ") fakt_stats ON fakt_stats.bill_to_klijent_id = k.klijent_id " +
      "WHERE proj_stats.broj_projekata > 0 OR fakt_stats.broj_faktura > 0 " +
      "ORDER BY ukupno_fakturisano DESC, k.naziv_klijenta ASC " +
      "LIMIT 3000";

    const rows = await query(sql, params);

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const brojProjekata = Number(r.broj_projekata) || 0;
      const ukupnoBudzetProjekata = Number(r.ukupno_budzet_projekata) || 0;
      const brojFaktura = Number(r.broj_faktura) || 0;
      const ukupnoFakturisano = Number(r.ukupno_fakturisano) || 0;
      const ukupnoNaplaceno = Number(r.ukupno_naplaceno) || 0;
      const potrazivanja = Number(r.potrazivanja) || 0;
      return {
        klijent_id: r.klijent_id,
        naziv_klijenta: r.naziv_klijenta || "—",
        broj_projekata: brojProjekata,
        ukupno_budzet_projekata: ukupnoBudzetProjekata,
        broj_faktura: brojFaktura,
        ukupno_fakturisano: ukupnoFakturisano,
        ukupno_naplaceno: ukupnoNaplaceno,
        potrazivanja: potrazivanja,
      };
    });

    const legacyByClient = await loadLegacyByClient();
    const liveIds = new Set(items.map((i) => i.klijent_id));

    for (const it of items) {
      const leg = legacyByClient.get(it.klijent_id);
      if (leg) {
        it.broj_projekata += leg.broj_projekata;
        it.ukupno_fakturisano += leg.ukupno_fakturisano;
        it.ukupno_budzet_projekata += leg.budzet;
        it.ukupno_naplaceno += leg.naplaceno;
      }
    }

    const legacyOnlyIds = [...legacyByClient.keys()].filter((id) => !liveIds.has(id));
    if (legacyOnlyIds.length > 0) {
      const placeholders = legacyOnlyIds.map(() => "?").join(",");
      const nameRows = (await query(
        `SELECT klijent_id, naziv_klijenta FROM klijenti WHERE klijent_id IN (${placeholders})`,
        legacyOnlyIds
      )) as { klijent_id: number; naziv_klijenta: string }[];
      const nazivById = new Map((nameRows ?? []).map((r) => [Number(r.klijent_id), r.naziv_klijenta ?? "—"]));
      for (const klijentId of legacyOnlyIds) {
        const leg = legacyByClient.get(klijentId)!;
        items.push({
          klijent_id: klijentId,
          naziv_klijenta: nazivById.get(klijentId) ?? "—",
          broj_projekata: leg.broj_projekata,
          ukupno_budzet_projekata: leg.budzet,
          broj_faktura: 0,
          ukupno_fakturisano: leg.ukupno_fakturisano,
          ukupno_naplaceno: leg.naplaceno,
          potrazivanja: 0,
        });
      }
    }

    items.sort((a, b) => {
      const diff = (b.ukupno_fakturisano ?? 0) - (a.ukupno_fakturisano ?? 0);
      if (diff !== 0) return diff;
      return String(a.naziv_klijenta ?? "").localeCompare(String(b.naziv_klijenta ?? ""), "hr");
    });

    const totalBrojProjekata = items.reduce((s, i) => s + i.broj_projekata, 0);
    const totalBudzetProjekata = items.reduce((s, i) => s + i.ukupno_budzet_projekata, 0);
    const totalBrojFaktura = items.reduce((s, i) => s + i.broj_faktura, 0);
    const totalFakturisano = items.reduce((s, i) => s + i.ukupno_fakturisano, 0);
    const totalNaplaceno = items.reduce((s, i) => s + i.ukupno_naplaceno, 0);
    const totalPotrazivanja = items.reduce((s, i) => s + i.potrazivanja, 0);

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_klijenata: items.length,
        ukupno_broj_projekata: totalBrojProjekata,
        ukupno_budzet_projekata: totalBudzetProjekata,
        ukupno_broj_faktura: totalBrojFaktura,
        ukupno_fakturisano: totalFakturisano,
        ukupno_naplaceno: totalNaplaceno,
        ukupno_potrazivanja: totalPotrazivanja,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
