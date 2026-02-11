import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function parseISODateOnly(v: string | null): string | null {
  if (!v) return null;
  // očekujemo YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const narucilac_id = searchParams.get("narucilac_id");
    const od = parseISODateOnly(searchParams.get("od"));
    const doD = parseISODateOnly(searchParams.get("do"));

    const where: string[] = [];
    const params: any[] = [];

    // samo status 8
    where.push("p.status_id = 8");

    if (narucilac_id && Number(narucilac_id) > 0) {
      where.push("p.narucilac_id = ?");
      params.push(Number(narucilac_id));
    }

    // period filter je po closed_at
    if (od) {
      where.push("a.closed_at >= ?");
      params.push(`${od} 00:00:00`);
    }
    if (doD) {
      where.push("a.closed_at <= ?");
      params.push(`${doD} 23:59:59`);
    }

    const sql = `
      SELECT
        p.projekat_id,
        p.radni_naziv,
        p.narucilac_id,
        kn.naziv_klijenta AS narucilac_naziv,
        kn.drzava AS narucilac_drzava,
        p.krajnji_klijent_id,
        kk.naziv_klijenta AS klijent_naziv,
        a.closed_at,
        vf.budzet_planirani,
        CASE
          WHEN COALESCE(kn.drzava,'') <> 'BiH' THEN NULL
          WHEN vf.budzet_planirani IS NULL THEN NULL
          ELSE ROUND(vf.budzet_planirani * 1.17, 2)
        END AS sa_pdv_km
      FROM projekti p
      JOIN (
        SELECT projekat_id, MIN(created_at) AS closed_at
        FROM project_audit
        WHERE action = 'PROJECT_CLOSE'
        GROUP BY projekat_id
      ) a ON a.projekat_id = p.projekat_id
      LEFT JOIN klijenti kn ON kn.klijent_id = p.narucilac_id
      LEFT JOIN klijenti kk ON kk.klijent_id = p.krajnji_klijent_id
      LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.closed_at DESC, p.projekat_id DESC
    `;

    const items = await query(sql, params);

    const narucioci = await query(
      `
        SELECT DISTINCT
          k.klijent_id,
          k.naziv_klijenta,
          k.drzava
        FROM klijenti k
        JOIN projekti p ON p.narucilac_id = k.klijent_id
        WHERE p.status_id = 8
        ORDER BY k.naziv_klijenta ASC
      `,
    );

    return NextResponse.json({ ok: true, items, narucioci }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
