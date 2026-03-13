import { NextResponse } from "next/server";
import { getStudioPoolExport } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Test DB konekcije. Vraća ok/error i trajanje. */
export async function GET() {
  const start = Date.now();
  try {
    const pool = getStudioPoolExport();
    await pool.query("SELECT 1 AS n");
    const ms = Date.now() - start;
    return NextResponse.json({
      ok: true,
      ms,
      db_name: process.env.DB_NAME ?? "(not set)",
    });
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: msg, ms },
      { status: 503 }
    );
  }
}
