// POST /api/projects/[id]/crew – snimi Crew članove
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function asInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const projekatId = asInt(id);
    if (!projekatId) {
      return NextResponse.json(
        { ok: false, error: "Neispravan projekat_id." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const radnikIds = Array.isArray(body?.radnik_ids)
      ? body.radnik_ids.map(asInt).filter((x): x is number => x != null)
      : [];

    if (radnikIds.length > 12) {
      return NextResponse.json(
        { ok: false, error: "Maksimalno 12 članova Crew-a." },
        { status: 400 },
      );
    }

    await query(`DELETE FROM projekat_crew WHERE projekat_id = ?`, [
      projekatId,
    ]);

    for (let i = 0; i < radnikIds.length; i++) {
      await query(
        `INSERT INTO projekat_crew (projekat_id, radnik_id, sort_order)
         VALUES (?, ?, ?)`,
        [projekatId, radnikIds[i], i],
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
