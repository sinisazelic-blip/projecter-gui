// src/app/api/fakture/za-fakturisanje/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Fakture → Za fakturisanje
 * Kanonski izvor "datuma zatvaranja" je project_audit (action='PROJECT_CLOSE'),
 * jer projekti_status_history trenutno nije u upotrebi (prazna tabela, bez triggera/rutina).
 */
export async function GET() {
  try {
    const sql = `
      SELECT
        p.projekat_id,
        p.radni_naziv,
        p.narucilac_id,
        kn.naziv_klijenta AS narucilac_naziv,
        p.krajnji_klijent_id,
        kk.naziv_klijenta AS krajnji_klijent_naziv,
        p.rok_glavni,
        p.status_id,
        a.closed_at
      FROM projekti p
      JOIN (
        SELECT projekat_id, MIN(created_at) AS closed_at
        FROM project_audit
        WHERE action = 'PROJECT_CLOSE'
        GROUP BY projekat_id
      ) a ON a.projekat_id = p.projekat_id
      LEFT JOIN klijenti kn ON kn.klijent_id = p.narucilac_id
      LEFT JOIN klijenti kk ON kk.klijent_id = p.krajnji_klijent_id
      WHERE p.status_id = 8
      ORDER BY a.closed_at DESC, p.projekat_id DESC
    `;

    const rows = await query(sql);

    return NextResponse.json({ ok: true, items: rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
