import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { withDbSession } from "@/lib/auth/with-db-session";
import {
  getUserAclMap,
  setUserAclMap,
} from "@/lib/auth/user-module-acl";
import type { AclAccess, UserAclMap } from "@/lib/auth/acl-catalog";
import { ACL_MODULES } from "@/lib/auth/acl-catalog";

export const dynamic = "force-dynamic";

function canManageAcl(nivo: number): boolean {
  return nivo >= 8;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return withDbSession(req, async () => {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? verifySessionToken(token) : null;
    if (!session || !canManageAcl(session.nivo ?? 0)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
    }
    const acl = await getUserAclMap(userId);
    return NextResponse.json({
      ok: true,
      acl: acl ?? {},
      modules: ACL_MODULES.map((m) => ({
        key: m.key,
        labelSr: m.labelSr,
        labelEn: m.labelEn,
        group: m.group,
        ownerOnlyDefault: !!m.ownerOnlyDefault,
      })),
    });
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return withDbSession(req, async () => {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? verifySessionToken(token) : null;
    if (!session || !canManageAcl(session.nivo ?? 0)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const raw = body?.acl;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { ok: false, error: "acl object required" },
        { status: 400 },
      );
    }

    // Empty object = clear ACL → fall back to role matrix
    if (Object.keys(raw).length === 0) {
      const cleared = await setUserAclMap(userId, {});
      if (!cleared.ok) {
        return NextResponse.json(cleared, { status: 500 });
      }
      return NextResponse.json({ ok: true, acl: {} });
    }

    const acl: UserAclMap = {};
    const allowed = new Set(ACL_MODULES.map((m) => m.key));
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!allowed.has(k)) continue;
      const a = String(v).toLowerCase();
      if (a === "none" || a === "view" || a === "edit") {
        acl[k] = a as AclAccess;
      }
    }
    const result = await setUserAclMap(userId, acl);
    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json({ ok: true, acl });
  });
}
