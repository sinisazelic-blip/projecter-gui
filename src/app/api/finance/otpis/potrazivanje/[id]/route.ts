import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * POST: Otpiši potraživanje (projekt_potrazivanja) – status = OTPISANO, razlog u napomenu.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const potrazivanjeId = Number(id);
    if (!Number.isFinite(potrazivanjeId) || potrazivanjeId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan potrazivanje_id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const razlog = typeof body?.razlog === "string" ? body.razlog.trim() : null;

    const existing = (await query(
      "SELECT potrazivanje_id, napomena FROM projekt_potrazivanja WHERE potrazivanje_id = ? LIMIT 1",
      [potrazivanjeId]
    )) as { potrazivanje_id: number; napomena: string | null }[];

    if (!existing?.length) {
      return NextResponse.json(
        { ok: false, error: "Potraživanje nije pronađeno" },
        { status: 404 }
      );
    }

    const napomena = existing[0].napomena ?? "";
    const append = razlog ? ` | Otpis: ${razlog}` : " | Otpis: nenaplativo";
    const newNapomena = (napomena + append).trim();

    await query(
      "UPDATE projekt_potrazivanja SET status = ?, napomena = ? WHERE potrazivanje_id = ?",
      ["OTPISANO", newNapomena, potrazivanjeId]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
