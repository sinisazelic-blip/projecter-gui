import { NextRequest, NextResponse } from "next/server";
import { suggestPostingContext } from "@/lib/finance/rasknjizavanje/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const postingId = Number(req.nextUrl.searchParams.get("posting_id"));
    if (!Number.isFinite(postingId) || postingId <= 0) {
      return NextResponse.json({ ok: false, error: "posting_id invalid" }, { status: 400 });
    }
    const ctx = await suggestPostingContext(postingId);
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "Posting nije pronađen" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...ctx });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
