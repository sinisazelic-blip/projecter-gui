import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bank/batches/stats?batch_id=12
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("batch_id");
    const batch_id = Number(raw);

    if (!raw || !Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid batch_id", debug: { raw } }, { status: 400 });
    }

    const out = await withTransaction(async (conn: any) => {
      const [brows]: any = await conn.execute(
        `SELECT batch_id, account_id, status FROM bank_import_batch WHERE batch_id = ? LIMIT 1`,
        [batch_id]
      );
      if (!Array.isArray(brows) || brows.length === 0) return { ok: false, error: "BATCH_NOT_FOUND" as const };

      const [st]: any = await conn.execute(`SELECT COUNT(*) AS cnt FROM bank_tx_staging WHERE batch_id = ?`, [batch_id]);
      const [m]: any = await conn.execute(
        `
        SELECT COUNT(*) AS cnt
        FROM bank_tx_match mm
        JOIN bank_tx_staging t ON t.tx_id = mm.tx_id
        WHERE t.batch_id = ?
        `,
        [batch_id]
      );
      const [p]: any = await conn.execute(`SELECT COUNT(*) AS cnt FROM bank_tx_posting WHERE batch_id = ?`, [batch_id]);
      const [l]: any = await conn.execute(`SELECT COUNT(*) AS cnt FROM bank_tx_cost_link WHERE batch_id = ?`, [batch_id]);

      return {
        ok: true,
        batch: brows[0],
        counts: {
          staging: Number(st?.[0]?.cnt ?? 0),
          matched: Number(m?.[0]?.cnt ?? 0),
          postings: Number(p?.[0]?.cnt ?? 0),
          cost_links: Number(l?.[0]?.cnt ?? 0),
        },
        marker: "BATCH_STATS_QP_V1",
      };
    });

    if (!out.ok && out.error === "BATCH_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "BATCH_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
