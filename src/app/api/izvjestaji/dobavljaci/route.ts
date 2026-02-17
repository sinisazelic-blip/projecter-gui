import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function normName(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type StagingRowById = { dobavljac_id?: number; stg_ukupno: number };
type StagingRowByName = { dobavljac_naziv: string; stg_ukupno: number };
type ByNameEntry = { displayName: string; sum: number };

/**
 * Učitaj iz staging/arhive ukupno po dobavljaču (stg_troskovi_dobavljaci_old) i spoji s live podacima.
 */
async function loadStagingTotals(): Promise<{
  byDobavljacId: Map<number, number>;
  byName: Map<string, ByNameEntry>;
}> {
  const byDobavljacId = new Map<number, number>();
  const byName = new Map<string, ByNameEntry>();

  try {
    const rows = (await query(
      `SELECT dobavljac_id, ROUND(SUM(COALESCE(iznos_km, iznos, 0)), 2) AS stg_ukupno
       FROM stg_troskovi_dobavljaci_old
       WHERE dobavljac_id IS NOT NULL
       GROUP BY dobavljac_id`,
      []
    )) as StagingRowById[];
    for (const r of rows ?? []) {
      const id = Number(r.dobavljac_id);
      if (!Number.isFinite(id)) continue;
      const val = Number(r.stg_ukupno) || 0;
      byDobavljacId.set(id, (byDobavljacId.get(id) ?? 0) + val);
    }
  } catch {
    // Tabela ili kolone ne postoje
  }

  try {
    const rows = (await query(
      `SELECT TRIM(COALESCE(naziv, '')) AS dobavljac_naziv,
              ROUND(SUM(COALESCE(iznos_km, iznos, 0)), 2) AS stg_ukupno
       FROM stg_troskovi_dobavljaci_old
       WHERE naziv IS NOT NULL AND TRIM(naziv) <> ''
       GROUP BY TRIM(naziv)`,
      []
    )) as StagingRowByName[];
    for (const r of rows ?? []) {
      const name = String(r.dobavljac_naziv ?? "").trim();
      if (!name) continue;
      const key = normName(name);
      const val = Number(r.stg_ukupno) || 0;
      const existing = byName.get(key);
      byName.set(key, {
        displayName: existing ? existing.displayName : name,
        sum: (existing?.sum ?? 0) + val,
      });
    }
  } catch {
    // Nema te kolone ili tabela drugačija
  }

  // stg_master_finansije — iznos_troska_km po dobavljac_id (20g istorija)
  try {
    const rows = (await query(
      `SELECT dobavljac_id, ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS stg_ukupno
       FROM stg_master_finansije
       WHERE dobavljac_id IS NOT NULL
       GROUP BY dobavljac_id`,
      []
    )) as StagingRowById[];
    for (const r of rows ?? []) {
      const id = Number(r.dobavljac_id);
      if (!Number.isFinite(id)) continue;
      const val = Number(r.stg_ukupno) || 0;
      byDobavljacId.set(id, (byDobavljacId.get(id) ?? 0) + val);
    }
  } catch {
    // Tabela ili kolone ne postoje
  }

  return { byDobavljacId, byName };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const where: string[] = ["dob.aktivan = 1"];
    const joinConditions: string[] = ["t.entity_type = 'vendor'", "t.entity_id = dob.dobavljac_id"];
    const params: any[] = [];

    if (dateFrom) {
      joinConditions.push("(t.datum_troska IS NULL OR t.datum_troska >= ?)");
      params.push(dateFrom);
    }
    if (dateTo) {
      joinConditions.push("(t.datum_troska IS NULL OR t.datum_troska <= ?)");
      params.push(dateTo + " 23:59:59");
    }

    const joinOnClause = joinConditions.join(" AND ");
    const whereClause = where.join(" AND ");

    const sql =
      "SELECT " +
      "dob.dobavljac_id, " +
      "dob.naziv AS dobavljac_naziv, " +
      "dob.vrsta AS dobavljac_vrsta, " +
      "dob.email, " +
      "dob.telefon, " +
      "dob.grad, " +
      "dob.drzava_iso2, " +
      "COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) AS ukupno_troskova, " +
      "COALESCE(SUM(CASE WHEN ps.stavka_id IS NOT NULL AND t.status <> 'STORNIRANO' THEN ps.iznos_km ELSE 0 END), 0) AS ukupno_placeno, " +
      "COUNT(DISTINCT t.projekat_id) AS broj_projekata, " +
      "COUNT(DISTINCT CASE WHEN t.status <> 'STORNIRANO' THEN t.trosak_id ELSE NULL END) AS broj_troskova " +
      "FROM dobavljaci dob " +
      "LEFT JOIN projektni_troskovi t ON " +
      joinOnClause +
      " " +
      "LEFT JOIN placanja_stavke ps ON ps.trosak_id = t.trosak_id " +
      "WHERE " +
      whereClause +
      " " +
      "GROUP BY dob.dobavljac_id, dob.naziv, dob.vrsta, dob.email, dob.telefon, dob.grad, dob.drzava_iso2 " +
      "HAVING COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) > 0 " +
      "   OR COALESCE(SUM(CASE WHEN ps.stavka_id IS NOT NULL AND t.status <> 'STORNIRANO' THEN ps.iznos_km ELSE 0 END), 0) > 0 " +
      "ORDER BY COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) DESC, dob.naziv ASC " +
      "LIMIT 3000";

    const rows = await query(sql, params);

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const ukupnoTroskova = Number(r.ukupno_troskova) || 0;
      const ukupnoPlaceno = Number(r.ukupno_placeno) || 0;
      const stanje = ukupnoTroskova - ukupnoPlaceno;
      return {
        dobavljac_id: r.dobavljac_id,
        dobavljac_naziv: r.dobavljac_naziv || "—",
        dobavljac_vrsta: r.dobavljac_vrsta || "—",
        email: r.email || null,
        telefon: r.telefon || null,
        grad: r.grad || null,
        drzava_iso2: r.drzava_iso2 || null,
        ukupno_troskova: ukupnoTroskova,
        ukupno_placeno: ukupnoPlaceno,
        stanje: stanje,
        broj_projekata: Number(r.broj_projekata) || 0,
        broj_troskova: Number(r.broj_troskova) || 0,
      };
    });

    const { byDobavljacId, byName } = await loadStagingTotals();
    const usedStagingNames = new Set<string>();

    for (const it of items) {
      const stgById =
        it.dobavljac_id != null ? byDobavljacId.get(Number(it.dobavljac_id)) : undefined;
      const byNameEntry = byName.get(normName(it.dobavljac_naziv));
      const stgByName = byNameEntry?.sum ?? 0;
      const stg = (stgById ?? 0) + stgByName;
      if (stg > 0) {
        it.ukupno_troskova += stg;
        it.ukupno_placeno += stg;
        it.stanje = it.ukupno_troskova - it.ukupno_placeno;
        if (byNameEntry != null) usedStagingNames.add(normName(it.dobavljac_naziv));
      }
    }

    // Redovi samo iz arhive — historijski "zatvoreno" (troškovi = plaćeno; dug storniran)
    for (const [key, entry] of byName) {
      if (usedStagingNames.has(key)) continue;
      const matchLive = items.some((i) => normName(i.dobavljac_naziv) === key);
      if (matchLive) continue;
      items.push({
        dobavljac_id: null,
        dobavljac_naziv: entry.displayName || "—",
        dobavljac_vrsta: "—",
        email: null,
        telefon: null,
        grad: null,
        drzava_iso2: null,
        ukupno_troskova: entry.sum,
        ukupno_placeno: entry.sum,
        stanje: 0,
        broj_projekata: 0,
        broj_troskova: 0,
      });
    }

    items.sort((a, b) => {
      const diff = (b.ukupno_troskova ?? 0) - (a.ukupno_troskova ?? 0);
      if (diff !== 0) return diff;
      return String(a.dobavljac_naziv ?? "").localeCompare(String(b.dobavljac_naziv ?? ""), "hr");
    });

    const totalTroskova = items.reduce((s, i) => s + i.ukupno_troskova, 0);
    const totalPlaceno = items.reduce((s, i) => s + i.ukupno_placeno, 0);
    const totalStanje = totalTroskova - totalPlaceno;

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_dobavljaca: items.length,
        ukupno_troskova: totalTroskova,
        ukupno_placeno: totalPlaceno,
        ukupno_stanje: totalStanje,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
