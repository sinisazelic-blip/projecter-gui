// GET: Obračun PDV za prijavu – period od–do.
import { NextResponse } from "next/server";
import { getLastMonthRange, getPdvPrijavaData } from "@/lib/pdv-prijava";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    let from = (url.searchParams.get("from") ?? "").trim();
    let to = (url.searchParams.get("to") ?? "").trim();
    const useLastMonth =
      url.searchParams.get("prošli_mjesec") === "1" || url.searchParams.get("prosli_mjesec") === "1";
    if (useLastMonth) {
      const range = getLastMonthRange();
      from = range.from;
      to = range.to;
    }
    const data = await getPdvPrijavaData(from, to);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error("GET /api/finance/pdv-prijava", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
