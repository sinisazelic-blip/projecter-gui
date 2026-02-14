import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * POST: Storniraj/otpiši dugovanje (projekt_dugovanja) – status = STORNO, razlog u napomenu.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const dugovanjeId = Number(id);
    if (!Number.isFinite(dugovanjeId) || dugovanjeId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan dugovanje_id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const razlog = typeof body?.razlog === "string" ? body.razlog.trim() : null;

    const existing = (await query(
      "SELECT dugovanje_id, napomena, status FROM projekt_dugovanja WHERE dugovanje_id = ? LIMIT 1",
      [dugovanjeId]
    )) as { dugovanje_id: number; napomena: string | null; status: string | null }[];

    if (!existing?.length) {
      return NextResponse.json(
        { ok: false, error: "Dugovanje nije pronađeno" },
        { status: 404 }
      );
    }

    if ((existing[0].status ?? "").toUpperCase() === "STORNO") {
      return NextResponse.json(
        { ok: false, error: "Dugovanje je već stornirano" },
        { status: 409 }
      );
    }

    const napomena = existing[0].napomena ?? "";
    const append = razlog ? ` | Storno: ${razlog}` : " | Storno";
    const newNapomena = (napomena + append).trim();

    await query(
      `UPDATE projekt_dugovanja SET status = ?, napomena = ? WHERE dugovanje_id = ?`,
      ["STORNO", newNapomena, dugovanjeId]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
