import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProjekatRow = {
  projekat_id: number;
  radni_naziv: string | null;
  tip: "account_manager" | "crew" | "faze";
};

/**
 * GET /api/studio/radnici/[id]/projekti
 * Vraća listu projekata na kojima je radnik angažovan:
 * - account_manager: projekti koje je otvorio
 * - crew: projekti gdje je u Crew timu
 * - faze: projekti gdje je dodijeljen u fazama
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const radnikId = Number(id);
    if (!Number.isFinite(radnikId) || radnikId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan radnik_id." },
        { status: 400 }
      );
    }

    const all: ProjekatRow[] = [];

    // 1. Account Manager – projekti koje je otvorio
    try {
      const amRows = await query<{ projekat_id: number; radni_naziv: string | null }>(
        `SELECT p.projekat_id, p.radni_naziv
         FROM projekti p
         WHERE p.account_manager_radnik_id = ?
         ORDER BY p.radni_naziv ASC`,
        [radnikId]
      );
      (amRows ?? []).forEach((r) => all.push({ ...r, tip: "account_manager" }));
    } catch {
      // kolona možda ne postoji
    }

    // 2. Crew – projekti gdje je u Crew timu
    try {
      const crewRows = await query<{ projekat_id: number; radni_naziv: string | null }>(
        `SELECT p.projekat_id, p.radni_naziv
         FROM projekat_crew pc
         JOIN projekti p ON p.projekat_id = pc.projekat_id
         WHERE pc.radnik_id = ?
         ORDER BY p.radni_naziv ASC`,
        [radnikId]
      );
      (crewRows ?? []).forEach((r) => all.push({ ...r, tip: "crew" }));
    } catch {
      // tabela možda ne postoji
    }

    // 3. Faze – projekti gdje je dodijeljen u fazama
    const fazeRows = await query<{ projekat_id: number; radni_naziv: string | null }>(
      `SELECT DISTINCT p.projekat_id, p.radni_naziv
       FROM projekat_faza_radnici pfr
       JOIN projekat_faze pf ON pf.projekat_faza_id = pfr.projekat_faza_id
       JOIN projekti p ON p.projekat_id = pf.projekat_id
       WHERE pfr.radnik_id = ?
       ORDER BY p.radni_naziv ASC`,
      [radnikId]
    );
    (fazeRows ?? []).forEach((r) => all.push({ ...r, tip: "faze" }));

    // Deduplikacija po projekat_id, zadržavamo prvi tip (prioritet: account_manager > crew > faze)
    const seen = new Set<number>();
    const deduped = all.filter((r) => {
      if (seen.has(r.projekat_id)) return false;
      seen.add(r.projekat_id);
      return true;
    });

    return NextResponse.json({
      ok: true,
      projekti: deduped.map((r) => ({
        projekat_id: Number(r.projekat_id),
        radni_naziv: r.radni_naziv ?? `Projekat #${r.projekat_id}`,
        tip: r.tip,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Greška" },
      { status: 500 }
    );
  }
}
