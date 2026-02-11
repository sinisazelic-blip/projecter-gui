export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __projecterPool: mysql.Pool | undefined;
}

function getPool() {
  if (!global.__projecterPool) {
    global.__projecterPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }
  return global.__projecterPool;
}

export async function GET() {
  try {
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT status_id, kod, naziv, opis, sort, redoslijed
       FROM projekt_statusi
       ORDER BY sort ASC, status_id ASC`,
    );

    return NextResponse.json({ success: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        message: e?.message ?? "DB error",
        code: e?.code ?? null,
      },
      { status: 500 },
    );
  }
}
