import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || "25060");

  try {
    const conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
      ssl: { rejectUnauthorized: false },
      connectTimeout: 8000,
    });

    const [rows] = await conn.query("SHOW CREATE VIEW vw_projekti_finansije");
    await conn.end();

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), code: e?.code },
      { status: 500 }
    );
  }
}
