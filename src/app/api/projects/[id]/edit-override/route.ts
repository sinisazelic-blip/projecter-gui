import { NextResponse } from "next/server";
import {
  disableProjectEditOverride,
  enableProjectEditOverride,
  getProjectEditOverrideState,
  getSessionFromRequest,
  isOwnerLike,
} from "@/lib/projects/deal-edit-guard";

function getProjectId(req: Request): number | null {
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
  try {
    const projekatId = getProjectId(req);
    if (!projekatId) {
      return NextResponse.json({ ok: false, error: "BAD_PROJECT_ID" }, { status: 400 });
    }
    const state = await getProjectEditOverrideState(projekatId);
    return NextResponse.json({ ok: true, active: !!state, state });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška pri čitanju override statusa." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req);
    if (!isOwnerLike(session)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const projekatId = getProjectId(req);
    if (!projekatId) {
      return NextResponse.json({ ok: false, error: "BAD_PROJECT_ID" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason ?? "").trim();
    const minutesRaw = Number(body?.minutes ?? 30);
    const minutes = Number.isFinite(minutesRaw) ? Math.trunc(minutesRaw) : 30;
    if (!reason) {
      return NextResponse.json({ ok: false, error: "REASON_REQUIRED" }, { status: 400 });
    }
    await enableProjectEditOverride({
      projekatId,
      reason,
      minutes,
      session: session!,
    });
    const state = await getProjectEditOverrideState(projekatId);
    return NextResponse.json({ ok: true, active: !!state, state });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška pri aktivaciji override moda." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = getSessionFromRequest(req);
    if (!isOwnerLike(session)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const projekatId = getProjectId(req);
    if (!projekatId) {
      return NextResponse.json({ ok: false, error: "BAD_PROJECT_ID" }, { status: 400 });
    }
    await disableProjectEditOverride({ projekatId, session: session! });
    return NextResponse.json({ ok: true, active: false });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška pri gašenju override moda." },
      { status: 500 },
    );
  }
}
