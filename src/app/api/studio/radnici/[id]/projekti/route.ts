import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/radnici/[id]/projekti
 * Vraća listu projekata na kojima je radnik angažovan (preko projekat_faza_radnici).
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

    const rows = await query<{ projekat_id: number; radni_naziv: string | null }>(
      `SELECT DISTINCT p.projekat_id, p.radni_naziv
         FROM projekat_faza_radnici pfr
         JOIN projekat_faze pf ON pf.projekat_faza_id = pfr.projekat_faza_id
         JOIN projekti p ON p.projekat_id = pf.projekat_id
        WHERE pfr.radnik_id = ?
        ORDER BY p.radni_naziv ASC`,
      [radnikId]
    );

    return NextResponse.json({
      ok: true,
      projekti: (rows ?? []).map((r) => ({
        projekat_id: Number(r.projekat_id),
        radni_naziv: r.radni_naziv ?? `Projekat #${r.projekat_id}`,
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
