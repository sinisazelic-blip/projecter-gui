// GET: lista svih ponuda (posljednja na vrhu), filteri: broj_ponude, klijent_id
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function asInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const x = Math.trunc(n);
  return x <= 0 ? null : x;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const brojPonude = url.searchParams.get("broj_ponude")?.trim() || "";
    const klijentId = asInt(url.searchParams.get("klijent_id"));

    const params: any[] = [];
    const whereClauses: string[] = [];
    if (brojPonude) {
      whereClauses.push("CONCAT('P', LPAD(p.broj_u_godini, 3, '0'), '/', p.godina) LIKE ?");
      params.push(`%${brojPonude}%`);
    }
    if (klijentId != null) {
      whereClauses.push("p.klijent_id = ?");
      params.push(klijentId);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const ponude = await query(
      `
      SELECT
        p.ponuda_id,
        p.inicijacija_id,
        p.godina,
        p.broj_u_godini,
        CONCAT('P', LPAD(p.broj_u_godini, 3, '0'), '/', p.godina) AS broj_ponude,
        p.datum_izdavanja,
        p.datum_vazenja,
        p.klijent_id,
        k.naziv_klijenta AS narucilac_naziv,
        p.valuta,
        p.created_at,
        (SELECT COALESCE(SUM(s.line_total), 0) FROM ponuda_stavke s WHERE s.ponuda_id = p.ponuda_id) AS ukupno
      FROM ponude p
      LEFT JOIN klijenti k ON k.klijent_id = p.klijent_id
      ${whereSql}
      ORDER BY p.created_at DESC, p.ponuda_id DESC
      LIMIT 500
      `,
      params,
    );

    const rows = Array.isArray(ponude) ? ponude : [];
    const ponudeFormatted = rows.map((r: any) => ({
      ponuda_id: r.ponuda_id,
      inicijacija_id: r.inicijacija_id,
      broj_ponude: r.broj_ponude,
      datum_izdavanja: r.datum_izdavanja,
      datum_vazenja: r.datum_vazenja,
      klijent_id: r.klijent_id,
      narucilac_naziv: r.narucilac_naziv ?? null,
      valuta: r.valuta ?? "KM",
      ukupno: Number(r.ukupno) || 0,
    }));

    let klijenti: any[] = [];
    try {
      klijenti = await query(
        `SELECT DISTINCT k.klijent_id, k.naziv_klijenta
         FROM ponude p
         JOIN klijenti k ON k.klijent_id = p.klijent_id
         ORDER BY k.naziv_klijenta ASC`,
      );
    } catch {
      klijenti = [];
    }

    return NextResponse.json({
      ok: true,
      ponude: ponudeFormatted,
      klijenti: Array.isArray(klijenti) ? klijenti : [],
    });
  } catch (e: any) {
    const msg = e?.message ?? "";
    if (msg.includes("ponude") || msg.includes("doesn't exist") || msg.includes("Unknown table")) {
      return NextResponse.json({ ok: true, ponude: [], klijenti: [] });
    }
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška (list ponude)" },
      { status: 500 },
    );
  }
}
