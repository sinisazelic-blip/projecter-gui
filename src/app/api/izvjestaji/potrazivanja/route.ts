import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { formatDateDMY, toIsoDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return "0-30";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
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
        k.rok_placanja_dana,
        f.osnovica_km AS iznos_bez_pdv,
        f.pdv_iznos_km AS pdv_iznos,
        f.iznos_ukupno_km AS iznos_sa_pdv,
        f.valuta
      FROM fakture f
      LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
      WHERE ${where.join(" AND ")}
      ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC
      `,
      params,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: any[] = [];
    const bucketSums: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

    for (const r of Array.isArray(rows) ? rows : []) {
      const datumIzdavanja = toIsoDate(r.datum_izdavanja);
      const rokDana = Number(r.rok_placanja_dana) || 0;
      let datumDospijeca: string | null = null;
      if (datumIzdavanja) {
        const d = new Date(datumIzdavanja);
        d.setDate(d.getDate() + rokDana);
        datumDospijeca = d.toISOString().slice(0, 10);
      }

      const dueDate = datumDospijeca ? new Date(datumDospijeca) : null;
      dueDate?.setHours(0, 0, 0, 0);
      const daysOverdue = dueDate && dueDate < today ? Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
      const bucket = agingBucket(daysOverdue);
      const iznos = Number(r.iznos_sa_pdv) || 0;
      bucketSums[bucket] = (bucketSums[bucket] || 0) + iznos;

      let brojFakture = r.broj_fakture;
      if (brojFakture && typeof brojFakture === "string") {
        const parts = brojFakture.split("/");
        if (parts.length === 2 && /^\d+$/.test(parts[0])) {
          brojFakture = `${String(Number(parts[0])).padStart(3, "0")}/${parts[1]}`;
        }
      }

      items.push({
        faktura_id: r.faktura_id,
        broj_fakture: brojFakture,
        datum_izdavanja: datumIzdavanja ? formatDateDMY(datumIzdavanja) : null,
        datum_dospijeca: datumDospijeca ? formatDateDMY(datumDospijeca) : null,
        narucilac_naziv: r.narucilac_naziv || "—",
        iznos_sa_pdv: iznos,
        valuta: r.valuta || "BAM",
        dana_kasnjenja: daysOverdue,
        aging_bucket: bucket,
      });
    }

    const ukupno = items.reduce((s, i) => s + i.iznos_sa_pdv, 0);

    return NextResponse.json({
      ok: true,
      items,
      summary: { po_bucketu: bucketSums, ukupno },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
