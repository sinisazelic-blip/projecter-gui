import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tx_id = Number(body?.tx_id);
    const projekat_id = body?.projekat_id != null ? Number(body.projekat_id) : null;
    const narucilac_id = body?.narucilac_id != null ? Number(body.narucilac_id) : null;
    const kategorija = body?.kategorija ?? null;

    if (!Number.isFinite(tx_id) || tx_id <= 0) {
      return NextResponse.json({ ok: false, error: "tx_id is required" }, { status: 400 });
    }

    const result = await withTransaction(async (conn) => {
      // obriši eventualni AUTO match (override)
      await conn.execute(
        `DELETE FROM bank_tx_match WHERE tx_id = ?`,
        [tx_id]
      );

      // upiši MANUAL match
      await conn.execute(
        `
        INSERT INTO bank_tx_match
          (tx_id, projekat_id, narucilac_id, kategorija, matched_by)
        VALUES
          (?, ?, ?, ?, 'MANUAL')
        `,
        [tx_id, projekat_id, narucilac_id, kategorija]
      );

      return { tx_id, projekat_id, narucilac_id, kategorija };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
