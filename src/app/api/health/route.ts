import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Brzi health check – bez DB. Ako ovo vraća 200, app je dostupan. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    db_name: process.env.DB_NAME ?? "(not set)",
  });
}
