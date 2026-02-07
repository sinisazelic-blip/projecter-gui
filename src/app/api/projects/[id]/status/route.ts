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
    });
  }
  return global.__projecterPool;
}

function extractProjectIdFromUrl(req: Request): { projekat_id: number | null; rawId: string | null } {
  const pathname = new URL(req.url).pathname; // npr. /api/projects/5691/status
  const parts = pathname.split("/").filter(Boolean); // ["api","projects","5691","status"]

  const i = parts.indexOf("projects");
  const rawId = i >= 0 ? parts[i + 1] ?? null : null;

  const projekat_id = rawId ? Number(rawId) : NaN;
  if (!Number.isFinite(projekat_id)) return { projekat_id: null, rawId };

  return { projekat_id, rawId };
}

export async function PATCH(req: Request) {
  // ✅ OWNER DECISION: manual status changes OFF (do not delete endpoint to avoid regressions)
  const { projekat_id, rawId } = extractProjectIdFromUrl(req);

  return NextResponse.json(
    {
      success: false,
      message:
        "Ručna promjena statusa je isključena (owner decision). Status se mijenja samo kroz sistemske operacije (Final OK, Faktura, Arhiviranje...).",
      projekat_id: projekat_id ?? null,
      rawId,
      code: "MANUAL_STATUS_DISABLED",
    },
    { status: 403 }
  );

  // NOTE: old logic intentionally kept below as reference (unreachable).
  // If in the future we re-enable it, it must be guarded by user roles (owner/admin only).
  //
  // const body = await req.json().catch(() => ({}));
  // const status_id = Number((body as any)?.status_id);
  //
  // if (!Number.isFinite(status_id)) {
  //   return NextResponse.json(
  //     { success: false, message: "Obavezno: status_id" },
  //     { status: 400 }
  //   );
  // }
  //
  // const pool = getPool();
  // const conn = await pool.getConnection();
  //
  // try {
  //   const [pchk] = await conn.query(
  //     `SELECT 1 FROM projekti WHERE projekat_id = ? LIMIT 1`,
  //     [projekat_id]
  //   );
  //   if (!(pchk as any[]).length) {
  //     return NextResponse.json(
  //       { success: false, message: "Projekat ne postoji", projekat_id },
  //       { status: 404 }
  //     );
  //   }
  //
  //   const [schk] = await conn.query(
  //     `SELECT 1 FROM projekt_statusi WHERE status_id = ? LIMIT 1`,
  //     [status_id]
  //   );
  //   if (!(schk as any[]).length) {
  //     return NextResponse.json(
  //       { success: false, message: "Nepoznat status_id", status_id },
  //       { status: 400 }
  //     );
  //   }
  //
  //   const [res] = await conn.query(
  //     `UPDATE projekti SET status_id = ? WHERE projekat_id = ?`,
  //     [status_id, projekat_id]
  //   );
  //
  //   return NextResponse.json({
  //     success: true,
  //     projekat_id,
  //     status_id,
  //     updated: (res as any)?.affectedRows ?? 0,
  //   });
  // } catch (e: any) {
  //   return NextResponse.json(
  //     { success: false, message: e?.message ?? "Internal error", code: e?.code ?? null },
  //     { status: 500 }
  //   );
  // } finally {
  //   conn.release();
  // }
}
