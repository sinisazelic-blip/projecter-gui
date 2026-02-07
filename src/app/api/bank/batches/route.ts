import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bank/batches?limit=50
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw ?? 50) || 50, 1), 200);

    const rows = await withTransaction(async (conn: any) => {
      const [r]: any = await conn.execute(
        `
        SELECT
          batch_id,
          account_id,
          status
        FROM bank_import_batch
        ORDER BY batch_id DESC
        LIMIT ?
        `,
        [limit]
      );
      return r;
    });

    return NextResponse.json({ ok: true, batches: rows, marker: "BATCH_LIST_V1" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
