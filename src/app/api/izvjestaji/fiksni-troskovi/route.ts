import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Formatira datum iz baze (Date ili string) u dd.mm.yyyy. */
function formatReportDate(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) return formatDateDMY(val) || null;
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return formatDateDMY(str.slice(0, 10)) || null;
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) return formatDateDMY(d) || null;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("date_from")?.trim() || null;
    const dateTo = url.searchParams.get("date_to")?.trim() || null;

    const where: string[] = [];
    const params: any[] = [];

    // Filter po datumu dospijeća ili zadnje_placeno
    if (dateFrom) {
      where.push("(COALESCE(f.datum_dospijeca, f.zadnje_placeno) >= ? OR f.zadnje_placeno >= ?)");
      params.push(dateFrom, dateFrom);
    }
    if (dateTo) {
      where.push("(COALESCE(f.datum_dospijeca, f.zadnje_placeno) <= ? OR f.zadnje_placeno <= ?)");
      params.push(dateTo + " 23:59:59", dateTo + " 23:59:59");
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    // Query za fiksne troškove
    const rows = await query(
      `
      SELECT
        f.trosak_id,
        f.naziv_troska,
        f.frekvencija,
        f.dan_u_mjesecu,
        f.datum_dospijeca,
        f.zadnje_placeno,
        f.iznos,
        f.valuta,
        f.nacin_placanja,
        f.aktivan,
        f.napomena,
        CASE
          WHEN f.valuta = 'BAM' OR f.valuta = 'KM' THEN f.iznos
          WHEN f.valuta = 'EUR' THEN f.iznos * 1.95583
          ELSE f.iznos
        END AS iznos_km
      FROM fiksni_troskovi f
      ${whereClause}
      ORDER BY f.aktivan DESC, f.trosak_id DESC
      LIMIT 2000
      `,
      params,
    );

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      trosak_id: r.trosak_id,
      naziv_troska: r.naziv_troska || "—",
      frekvencija: r.frekvencija || "—",
      dan_u_mjesecu: r.dan_u_mjesecu || null,
      datum_dospijeca: formatReportDate(r.datum_dospijeca),
      zadnje_placeno: formatReportDate(r.zadnje_placeno),
      iznos: Number(r.iznos) || 0,
      iznos_km: Number(r.iznos_km) || 0,
      valuta: r.valuta || "BAM",
      nacin_placanja: r.nacin_placanja || "—",
      aktivan: r.aktivan ? "Da" : "Ne",
      napomena: r.napomena || null,
    }));

    // Agregirani podaci za summary
    const ukupnoFiksnihTroskova = items.reduce((s, i) => s + i.iznos_km, 0);

    // Ukupno projektnih troškova (ako postoji filter po datumu, filtriraj po datum_troska)
    const projektniWhere: string[] = [];
    const projektniParams: any[] = [];
    if (dateFrom) {
      projektniWhere.push("t.datum_troska >= ?");
      projektniParams.push(dateFrom);
    }
    if (dateTo) {
      projektniWhere.push("t.datum_troska <= ?");
      projektniParams.push(dateTo + " 23:59:59");
    }
    projektniWhere.push("t.status <> 'STORNIRANO'");
    const projektniWhereClause = projektniWhere.length ? "WHERE " + projektniWhere.join(" AND ") : "WHERE t.status <> 'STORNIRANO'";

    const projektniRows = await query(
      `
      SELECT COALESCE(SUM(t.iznos_km), 0) AS ukupno_projektnih_troskova
      FROM projektni_troskovi t
      ${projektniWhereClause}
      `,
      projektniParams,
    );
    const ukupnoProjektnihTroskova = Number(projektniRows?.[0]?.ukupno_projektnih_troskova) || 0;

    // Ukupno prihoda iz faktura (ako postoji filter po datumu, filtriraj po datum_izdavanja)
    const prihodiWhere: string[] = [];
    const prihodiParams: any[] = [];
    prihodiWhere.push("(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))");
    if (dateFrom) {
      prihodiWhere.push("f.datum_izdavanja >= ?");
      prihodiParams.push(dateFrom);
    }
    if (dateTo) {
      prihodiWhere.push("f.datum_izdavanja <= ?");
      prihodiParams.push(dateTo + " 23:59:59");
    }
    const prihodiWhereClause = prihodiWhere.length ? "WHERE " + prihodiWhere.join(" AND ") : "";

    const prihodiRows = await query(
      `
      SELECT COALESCE(SUM(f.iznos_ukupno_km), 0) AS ukupno_prihoda
      FROM fakture f
      ${prihodiWhereClause}
      `,
      prihodiParams,
    );
    const ukupnoPrihoda = Number(prihodiRows?.[0]?.ukupno_prihoda) || 0;

    const ukupnoTroskova = ukupnoFiksnihTroskova + ukupnoProjektnihTroskova;

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        broj_fiksnih_troskova: items.length,
        ukupno_fiksnih_troskova: ukupnoFiksnihTroskova,
        ukupno_projektnih_troskova: ukupnoProjektnihTroskova,
        ukupno_troskova: ukupnoTroskova,
        ukupno_prihoda: ukupnoPrihoda,
        razlika: ukupnoPrihoda - ukupnoTroskova,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
