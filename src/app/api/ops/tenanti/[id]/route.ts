import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import {
  addMonthsIso,
  extendEnterTenant,
  getEnterTenant,
  updateEnterTenantModules,
} from "@/lib/ops/tenanti";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireEnterApi();
  if (auth.error || !auth.session) return auth.error;

  const tenantId = Number((await params).id);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  let body: {
    action?: string;
    subscription_ends_at?: string;
    extend_months?: number;
    package_id?: string;
    modules?: string[];
    broj_blagajni?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const actor = {
    actorUserId: auth.session.user_id,
    actorUsername: auth.session.username,
  };

  try {
    const action = String(body.action ?? "").toUpperCase();
    if (action === "EXTEND") {
      const current = await getEnterTenant(tenantId);
      if (!current) {
        return NextResponse.json(
          { ok: false, error: "TENANT_NOT_FOUND" },
          { status: 404 },
        );
      }
      let endsAt = String(body.subscription_ends_at ?? "").trim().slice(0, 10);
      const months = Number(body.extend_months);
      if (!endsAt && Number.isInteger(months) && months > 0 && months <= 36) {
        const today = new Date().toISOString().slice(0, 10);
        const base =
          current.subscription_ends_at < today
            ? today
            : current.subscription_ends_at;
        endsAt = addMonthsIso(base, months);
      }
      if (!endsAt) {
        return NextResponse.json(
          { ok: false, error: "INVALID_DATE" },
          { status: 400 },
        );
      }
      const tenant = await extendEnterTenant({
        tenantId,
        endsAt,
        ...actor,
      });
      return NextResponse.json({ ok: true, tenant });
    }

    if (action === "MODULES") {
      const tenant = await updateEnterTenantModules({
        tenantId,
        packageId: String(body.package_id ?? ""),
        modules: Array.isArray(body.modules) ? body.modules.map(String) : [],
        brojBlagajni:
          body.broj_blagajni != null ? Number(body.broj_blagajni) : undefined,
        ...actor,
      });
      return NextResponse.json({ ok: true, tenant });
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status =
      msg === "TENANT_NOT_FOUND"
        ? 404
        : msg === "INVALID_DATE" || msg === "INVALID_PACKAGE"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
