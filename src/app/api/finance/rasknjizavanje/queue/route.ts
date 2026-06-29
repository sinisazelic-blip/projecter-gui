import { NextResponse } from "next/server";
import { getUnallocatedQueue } from "@/lib/finance/rasknjizavanje/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const batchId = Number(url.searchParams.get("batch_id") || 0);
    const batchFilter =
      Number.isFinite(batchId) && batchId > 0 ? batchId : null;
    const rows = await getUnallocatedQueue(150, batchFilter);
    return NextResponse.json({
      ok: true,
      rows,
      count: rows.length,
      batch_id: batchFilter,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
