import { NextResponse } from "next/server";
import { getPdvYearOverview } from "@/lib/pdv-prijava";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const yearRaw = searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : new Date().getFullYear();
    const data = await getPdvYearOverview(year);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
