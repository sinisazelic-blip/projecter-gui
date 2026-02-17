import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

type StgByPo = { id_po: number; stg_budzet: number; stg_troskovi: number };

/**
 * Iz stg_master_finansije po id_po: iznos_km -> budžet, iznos_troska_km -> troškovi (istorija).
 */
async function loadStagingByProjekat(): Promise<Map<number, { budzet: number; troskovi: number }>> {
  const map = new Map<number, { budzet: number; troskovi: number }>();
  try {
    const rows = (await query(
      `SELECT id_po,
              ROUND(SUM(COALESCE(iznos_km, 0)), 2) AS stg_budzet,
              ROUND(SUM(COALESCE(iznos_troska_km, 0)), 2) AS stg_troskovi
       FROM stg_master_finansije
       WHERE id_po IS NOT NULL
       GROUP BY id_po`,
      []
    )) as StgByPo[];
    for (const r of rows ?? []) {
      const id = Number(r.id_po);
      if (!Number.isFinite(id)) continue;
      map.set(id, {
        budzet: Number(r.stg_budzet) || 0,
        troskovi: Number(r.stg_troskovi) || 0,
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

    const where: string[] = [];
    const params: any[] = [];

    if (dateFrom) {
      where.push("(p.rok_glavni IS NULL OR p.rok_glavni >= ?)");
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push("(p.rok_glavni IS NULL OR p.rok_glavni <= ?)");
      params.push(dateTo + " 23:59:59");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const budgetExpr = "COALESCE(vf.budzet_planirani, p.budzet_planirani, 0)";
    const costsExpr = "COALESCE(vf.troskovi_ukupno, tc.troskovi_ukupno, 0)";

    const rows = await query(
      `
      SELECT
        p.projekat_id,
        p.id_po,
        p.radni_naziv,
        p.naziv_za_fakturu,
        p.narucilac_id,
        p.krajnji_klijent_id,
        p.status_id,
        p.rok_glavni,
        sp.naziv_statusa AS status_naziv,
        k.naziv_klijenta AS narucilac_naziv,
        ${budgetExpr} AS budzet_planirani,
        ${costsExpr} AS troskovi_ukupno,
        (${budgetExpr} - ${costsExpr}) AS planirana_zarada
      FROM projekti p
      LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
      LEFT JOIN (
        SELECT projekat_id, ROUND(SUM(iznos_km), 2) AS troskovi_ukupno
        FROM projektni_troskovi
        WHERE status <> 'STORNIRANO'
        GROUP BY projekat_id
      ) tc ON tc.projekat_id = p.projekat_id
      JOIN statusi_projekta sp ON sp.status_id = p.status_id
      LEFT JOIN klijenti k ON k.klijent_id = p.narucilac_id
      ${whereSql}
      ORDER BY p.status_id ASC, p.projekat_id ASC
      LIMIT 5000
      `,
      params,
    );

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      projekat_id: r.projekat_id,
      id_po: r.id_po ?? "",
      radni_naziv: r.radni_naziv ?? "—",
      naziv_za_fakturu: r.naziv_za_fakturu ?? "",
      status_id: r.status_id,
      status_naziv: r.status_naziv ?? "—",
      narucilac_naziv: r.narucilac_naziv ?? "—",
      rok_glavni: r.rok_glavni ? formatDateDMY(String(r.rok_glavni).slice(0, 10)) : null,
      budzet_planirani: Number(r.budzet_planirani) || 0,
      troskovi_ukupno: Number(r.troskovi_ukupno) || 0,
      planirana_zarada: Number(r.planirana_zarada) || 0,
    }));

    const stgByPo = await loadStagingByProjekat();
    for (const it of items) {
      const idPo = it.id_po != null && it.id_po !== "" ? Number(it.id_po) : NaN;
      if (!Number.isFinite(idPo)) continue;
      const stg = stgByPo.get(idPo);
      if (stg) {
        it.budzet_planirani += stg.budzet;
        it.troskovi_ukupno += stg.troskovi;
        it.planirana_zarada = it.budzet_planirani - it.troskovi_ukupno;
      }
    }

    const ukupno_budzet = items.reduce((s, i) => s + i.budzet_planirani, 0);
    const ukupno_troskovi = items.reduce((s, i) => s + i.troskovi_ukupno, 0);
    const ukupno_zarada = items.reduce((s, i) => s + i.planirana_zarada, 0);

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_projekata: items.length,
        ukupno_budzet,
        ukupno_troskovi,
        ukupno_planirana_zarada: ukupno_zarada,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
