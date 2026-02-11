import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  if (!q)
    return NextResponse.json(
      { ok: false, error: "Missing q" },
      { status: 400 },
    );

  try {
    const rows = await query(q);
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
