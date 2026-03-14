import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDemoPoolOrNull } from "@/lib/db";

/**
 * GET /api/debug/demo-status
 * Vraća status demo baze i korisnika "demo" – da vidimo zašto demo login ne radi.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, unknown> = {
    demo_db_name_set: !!process.env.DEMO_DB_NAME,
    demo_db_name_value: process.env.DEMO_DB_NAME || null,
    pool_ok: false,
    user_exists: false,
    password_matches: false,
    error: null,
  };

  if (!process.env.DEMO_DB_NAME) {
    return NextResponse.json(result);
  }

  try {
    const pool = getDemoPoolOrNull();
    if (!pool) {
      result.error = "getDemoPoolOrNull() returned null";
      return NextResponse.json(result);
    }
    result.pool_ok = true;

    let rows: { user_id: number; username: string; password?: string; password_hash?: string }[];
    try {
      const [r] = await pool.query(
        "SELECT user_id, username, password FROM users WHERE username = 'demo' AND aktivan = 1 LIMIT 1"
      );
      rows = r as typeof rows;
    } catch {
      const [r] = await pool.query(
        "SELECT user_id, username, password_hash AS password FROM users WHERE username = 'demo' AND aktivan = 1 LIMIT 1"
      );
      rows = r as typeof rows;
    }
    const user = rows?.[0];
    if (!user) {
      result.error = "Korisnik 'demo' nije pronađen u demo bazi.";
      return NextResponse.json(result);
    }
    result.user_exists = true;
    result.user_id = user.user_id;

    const hash = user.password ?? (user as { password_hash?: string }).password_hash ?? "";
    const matches = hash.startsWith("$2")
      ? await bcrypt.compare("demo", hash)
      : hash === "demo";
    result.password_matches = matches;
    if (!matches) {
      result.error = "Lozinka u bazi ne odgovara 'demo'. Samopopravka bi trebala to ispraviti pri sljedećem login pokušaju.";
    }

    return NextResponse.json(result);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(result);
  }
}
