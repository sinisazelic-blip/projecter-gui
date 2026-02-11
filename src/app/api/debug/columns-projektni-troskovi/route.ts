import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || "25060");

  if (!host || !user || !password || !database) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing env vars. Need DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and optionally DB_PORT).",
        present: {
          DB_HOST: !!host,
          DB_USER: !!user,
          DB_PASSWORD: !!password,
          DB_NAME: !!database,
          DB_PORT: process.env.DB_PORT || null,
        },
      },
      { status: 500 },
    );
  }

  try {
    const conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
      // DO managed mysql često traži TLS; za debug dopuštamo ovu opciju
      ssl: { rejectUnauthorized: false },
      connectTimeout: 8000,
    });

    const [rows] = await conn.query("SHOW COLUMNS FROM projektni_troskovi");
    await conn.end();

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        code: e?.code,
      },
      { status: 500 },
    );
  }
}
