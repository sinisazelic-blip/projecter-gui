// src/app/api/projects/[id]/status/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function getIdFromUrl(req: Request): number | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // očekujemo: api / projects / {id} / status
    const i = parts.indexOf("projects");
    if (i === -1) return null;
    const raw = parts[i + 1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const id = getIdFromUrl(req);
    if (!id) {
      return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
    }

    const rows: any[] = await query(
      `
      SELECT
        p.projekat_id,
        p.status_id,
        sp.naziv_statusa AS status_name
      FROM projekti p
      LEFT JOIN statusi_projekta sp
        ON sp.status_id = p.status_id
      WHERE p.projekat_id = ?
      LIMIT 1
      `,
      [id]
    );

    const row = rows?.[0] ?? null;
    if (!row) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND", projekat_id: id }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      row: {
        projekat_id: Number(row.projekat_id),
        status_id: Number(row.status_id),
        status_name: row.status_name ? String(row.status_name) : null,
      },
    });
  } catch (e: any) {
    // ✅ vrati stvarni error tekst da ga vidiš odmah u Network tab-u
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }

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
