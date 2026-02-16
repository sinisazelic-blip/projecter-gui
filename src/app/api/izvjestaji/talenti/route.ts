import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Normalize name for matching (trim, lowercase). */
function normName(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type StagingRowByTalentId = { talent_id: number; stg_ukupno: number };
type StagingRowByName = { talent_naziv: string; stg_ukupno: number };

type ByNameEntry = { displayName: string; sum: number };

/**
 * Učitaj iz staging/arhive tabela ukupno po talentu i spoji s live podacima.
 * Pokušava: stg_troskovi_talenti_old (po talent_id ili po naziv/ime_prezime), zatim talent_istorija (po talent_id).
 */
async function loadStagingTotals(): Promise<{
  byTalentId: Map<number, number>;
  byName: Map<string, ByNameEntry>;
}> {
  const byTalentId = new Map<number, number>();
  const byName = new Map<string, ByNameEntry>();

  // 1) stg_troskovi_talenti_old — po talent_id
  try {
    const rows = (await query(
      `SELECT talent_id, ROUND(SUM(COALESCE(iznos_km, iznos, 0)), 2) AS stg_ukupno
       FROM stg_troskovi_talenti_old
       WHERE talent_id IS NOT NULL
       GROUP BY talent_id`,
      []
    )) as StagingRowByTalentId[];
    for (const r of rows ?? []) {
      const id = Number(r.talent_id);
      if (!Number.isFinite(id)) continue;
      const val = Number(r.stg_ukupno) || 0;
      byTalentId.set(id, (byTalentId.get(id) ?? 0) + val);
    }
  } catch {
    // Tabela ili kolone ne postoje
  }

  // 2) stg_troskovi_talenti_old — po naziv ili ime_prezime
  try {
    const rows = (await query(
      `SELECT COALESCE(TRIM(naziv), TRIM(ime_prezime)) AS talent_naziv,
              ROUND(SUM(COALESCE(iznos_km, iznos, 0)), 2) AS stg_ukupno
       FROM stg_troskovi_talenti_old
       WHERE (naziv IS NOT NULL AND TRIM(naziv) <> '') OR (ime_prezime IS NOT NULL AND TRIM(ime_prezime) <> '')
       GROUP BY COALESCE(TRIM(naziv), TRIM(ime_prezime))`,
      []
    )) as StagingRowByName[];
    for (const r of rows ?? []) {
      const name = String(r.talent_naziv ?? "").trim();
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

  // 3) talent_istorija — ako ima talent_id i iznos/iznos_km
  try {
    const rows = (await query(
      `SELECT talent_id, ROUND(SUM(COALESCE(iznos_km, iznos, 0)), 2) AS stg_ukupno
       FROM talent_istorija
       WHERE talent_id IS NOT NULL
       GROUP BY talent_id`,
      []
    )) as StagingRowByTalentId[];
    for (const r of rows ?? []) {
      const id = Number(r.talent_id);
      if (!Number.isFinite(id)) continue;
      const val = Number(r.stg_ukupno) || 0;
      byTalentId.set(id, (byTalentId.get(id) ?? 0) + val);
    }
  } catch {
    // Tabela ili kolone drugačije
  }

  return { byTalentId, byName };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const where: string[] = ["tal.aktivan = 1"];
    const joinConditions: string[] = ["t.entity_type = 'talent'", "t.entity_id = tal.talent_id"];
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
      "tal.talent_id, " +
      "tal.ime_prezime AS talent_naziv, " +
      "tal.vrsta AS talent_vrsta, " +
      "tal.email, " +
      "tal.telefon, " +
      "COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) AS ukupno_troskova, " +
      "COALESCE(SUM(CASE WHEN ps.stavka_id IS NOT NULL AND t.status <> 'STORNIRANO' THEN ps.iznos_km ELSE 0 END), 0) AS ukupno_placeno, " +
      "COUNT(DISTINCT t.projekat_id) AS broj_projekata, " +
      "COUNT(DISTINCT CASE WHEN t.status <> 'STORNIRANO' THEN t.trosak_id ELSE NULL END) AS broj_troskova " +
      "FROM talenti tal " +
      "LEFT JOIN projektni_troskovi t ON " +
      joinOnClause +
      " " +
      "LEFT JOIN placanja_stavke ps ON ps.trosak_id = t.trosak_id " +
      "WHERE " +
      whereClause +
      " " +
      "GROUP BY tal.talent_id, tal.ime_prezime, tal.vrsta, tal.email, tal.telefon " +
      "HAVING COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) > 0 " +
      "   OR COALESCE(SUM(CASE WHEN ps.stavka_id IS NOT NULL AND t.status <> 'STORNIRANO' THEN ps.iznos_km ELSE 0 END), 0) > 0 " +
      "ORDER BY COALESCE(SUM(CASE WHEN t.status <> 'STORNIRANO' THEN t.iznos_km ELSE 0 END), 0) DESC, tal.ime_prezime ASC " +
      "LIMIT 500";

    const rows = await query(sql, params);

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const ukupnoTroskova = Number(r.ukupno_troskova) || 0;
      const ukupnoPlaceno = Number(r.ukupno_placeno) || 0;
      const stanje = ukupnoTroskova - ukupnoPlaceno;
      return {
        talent_id: r.talent_id,
        talent_naziv: r.talent_naziv || "—",
        talent_vrsta: r.talent_vrsta || "—",
        email: r.email || null,
        telefon: r.telefon || null,
        ukupno_troskova: ukupnoTroskova,
        ukupno_placeno: ukupnoPlaceno,
        stanje: stanje,
        broj_projekata: Number(r.broj_projekata) || 0,
        broj_troskova: Number(r.broj_troskova) || 0,
      };
    });

    // Učitaj arhivu/staging i spoji
    const { byTalentId, byName } = await loadStagingTotals();
    const usedStagingNames = new Set<string>();

    for (const it of items) {
      const stgById = it.talent_id != null ? byTalentId.get(Number(it.talent_id)) : undefined;
      const byNameEntry = byName.get(normName(it.talent_naziv));
      const stgByName = byNameEntry?.sum ?? 0;
      const stg = (stgById ?? 0) + stgByName;
      if (stg > 0) {
        it.ukupno_troskova += stg;
        it.stanje = it.ukupno_troskova - it.ukupno_placeno;
        if (byNameEntry != null) usedStagingNames.add(normName(it.talent_naziv));
      }
    }

    // Dodaj redove samo iz arhive (nema ih u live listi)
    for (const [key, entry] of byName) {
      if (usedStagingNames.has(key)) continue;
      const matchLive = items.some((i) => normName(i.talent_naziv) === key);
      if (matchLive) continue;
      items.push({
        talent_id: null,
        talent_naziv: entry.displayName || "—",
        talent_vrsta: "—",
        email: null,
        telefon: null,
        ukupno_troskova: entry.sum,
        ukupno_placeno: 0,
        stanje: entry.sum,
        broj_projekata: 0,
        broj_troskova: 0,
      });
    }

    // Ponovo sortiraj po ukupno_troskova DESC
    items.sort((a, b) => {
      const diff = (b.ukupno_troskova ?? 0) - (a.ukupno_troskova ?? 0);
      if (diff !== 0) return diff;
      return String(a.talent_naziv ?? "").localeCompare(String(b.talent_naziv ?? ""), "hr");
    });

    const totalTroskova = items.reduce((s, i) => s + i.ukupno_troskova, 0);
    const totalPlaceno = items.reduce((s, i) => s + i.ukupno_placeno, 0);
    const totalStanje = totalTroskova - totalPlaceno;

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_talenta: items.length,
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
