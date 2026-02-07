// src/app/api/projects/[id]/close/route.ts
import { NextResponse } from "next/server";
import { getCloseCheck } from "@/lib/projects/close";
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

function getUserLabel(req: Request) {
  return (
    req.headers.get("x-user") ||
    req.headers.get("x-user-email") ||
    req.headers.get("x-user-name") ||
    "system"
  );
}

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
}

export async function POST(req: Request) {
  const projekatId = getIdFromUrl(req);
  if (!projekatId) {
    return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const force = Boolean((body as any)?.force);

  const check = await getCloseCheck(projekatId);
  if (!check) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (!check.ok_to_close) {
    return NextResponse.json(
      { ok: false, error: "CLOSE_BLOCKED", ...check },
      { status: 409 }
    );
  }

  if (check.warnings.length > 0 && !force) {
    return NextResponse.json(
      { ok: false, error: "CLOSE_NEEDS_CONFIRM", ...check },
      { status: 409 }
    );
  }

  // ✅ ZATVOREN (soft-lock): status_id = 8
  await query(`UPDATE projekti SET status_id = 8 WHERE projekat_id = ?`, [projekatId]);



  // ✅ audit log
  const user_label = getUserLabel(req);
  const ip = getIp(req);
  const details = {
    force,
    warnings: check.warnings,
    summary: check.summary,
  };

  await query(
    `INSERT INTO project_audit (projekat_id, action, details, user_label, ip)
     VALUES (?, 'PROJECT_CLOSE', CAST(? AS JSON), ?, ?)`,
    [projekatId, JSON.stringify(details), user_label, ip]
  );

  const after = await getCloseCheck(projekatId);

  return NextResponse.json(
    { ok: true, message: "Projekat zatvoren (soft-lock).", projekat_id: projekatId, after },
    { status: 200 }
  );
}
