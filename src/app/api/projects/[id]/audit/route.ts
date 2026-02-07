import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function getIdFromUrl(req: Request): number | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("projects");
    if (i === -1) return null;
    const raw = parts[i + 1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const projekatId = getIdFromUrl(req);
  if (!projekatId) {
    return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  }

  const rows = await query(
    `
    SELECT audit_id, action, details, user_label, ip, created_at
    FROM project_audit
    WHERE projekat_id = ?
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [projekatId]
  );

  return NextResponse.json({ ok: true, data: rows }, { status: 200 });
}
