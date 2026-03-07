// src/app/api/fakture/wizard/preview-data/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function parseIds(idsRaw: string | null): number[] {
  if (!idsRaw) return [];
  return idsRaw
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ids = parseIds(url.searchParams.get("ids"));

    if (ids.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing ids",
          ids: [],
          projects: [],
          buyer: null,
          firma: null,
          narucioc_count: 0,
        },
        { status: 400 },
      );
    }

    const inList = ids.map(() => "?").join(",");

    // 1) Projekti + zatvaranje + budžet (KANON: vw_projekti_finansije)
    const projectsSql = `
      SELECT
        p.projekat_id,
        p.radni_naziv,
        p.narucilac_id,
        kn.naziv_klijenta AS narucilac_naziv,
        kn.drzava        AS narucilac_drzava,
        p.krajnji_klijent_id,
        kk.naziv_klijenta AS klijent_naziv,
        pf.budzet_planirani AS budzet_planirani,
        a.closed_at AS closed_at
      FROM projekti p
      LEFT JOIN klijenti kn ON kn.klijent_id = p.narucilac_id
      LEFT JOIN klijenti kk ON kk.klijent_id = p.krajnji_klijent_id
      LEFT JOIN vw_projekti_finansije pf ON pf.projekat_id = p.projekat_id
      LEFT JOIN (
        SELECT projekat_id, MIN(created_at) AS closed_at
        FROM project_audit
        WHERE action = 'PROJECT_CLOSE'
        GROUP BY projekat_id
      ) a ON a.projekat_id = p.projekat_id
      WHERE p.projekat_id IN (${inList})
      ORDER BY p.projekat_id ASC
    `;
    const projects = await query(projectsSql, ids);

    // 2) Naručilac (buyer) — mora biti jedan
    const narucioci = Array.from(
      new Set(
        (projects as any[])
          .map((p) => p?.narucilac_id)
          .filter((x) => x !== null && x !== undefined),
      ),
    );
    const narucioc_count = narucioci.length;

    let buyer: any = null;
    if (narucioci.length === 1) {
      const buyerRows = await query(
        `SELECT * FROM klijenti WHERE klijent_id = ? LIMIT 1`,
        [narucioci[0]],
      );
      buyer =
        Array.isArray(buyerRows) && buyerRows.length ? buyerRows[0] : null;

      // pomoćno: INO = sve osim BiH (bih, ba, bosna i hercegovina)
      if (buyer) {
        const drz = String(buyer.drzava ?? "").trim().toLowerCase();
        const isBiH = !drz || drz === "bih" || drz === "ba" ||
          drz === "bosna i hercegovina" || drz === "bosnia and herzegovina";
        buyer.is_ino = !isBiH;
      }
    }

    // 3) Firma (PRAVNO LICE) — aktivni profil + računi
    let firma_profile: any = null;
    const firmaRows = await query(
      `
        SELECT *
        FROM firma_profile
        WHERE is_active = 1
        ORDER BY updated_at DESC, firma_id DESC
        LIMIT 1
      `,
    );
    firma_profile =
      Array.isArray(firmaRows) && firmaRows.length ? firmaRows[0] : null;

    let firma_accounts: any[] = [];
    if (firma_profile?.firma_id) {
      const accRows = await query(
        `SELECT * FROM firma_bank_accounts WHERE firma_id = ? ORDER BY bank_account_id ASC`,
        [firma_profile.firma_id],
      );
      firma_accounts = Array.isArray(accRows) ? accRows : [];
    }

    // vraćamo u jednom objektu da UI ima sve na jednom mjestu
    const firma = firma_profile
      ? {
          ...firma_profile,
          bank_accounts: firma_accounts,
        }
      : null;

    // Fiskalni uređaj: ako je base_url postavljen, wizard preview prikazuje Fiskalizuj (bez izbora ručno/automatski)
    let fiskal_configured = false;
    if (firma_profile?.firma_id) {
      const fiskalRows = await query(
        `SELECT base_url FROM firma_fiskal_settings WHERE firma_id = ? AND base_url IS NOT NULL AND TRIM(base_url) != ''`,
        [firma_profile.firma_id],
      );
      fiskal_configured = Array.isArray(fiskalRows) && fiskalRows.length > 0;
    }

    return NextResponse.json(
      { ok: true, ids, projects, buyer, firma, narucioc_count, fiskal_configured },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
