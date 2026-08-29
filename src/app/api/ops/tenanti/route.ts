import { NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import { listEnterTenantAudit, listEnterTenants } from "@/lib/ops/tenanti";
import { ENTERSYS_BASE_PACKAGES, ENTERSYS_MODULE_KEYS } from "@/lib/entersys-activation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  try {
    const [tenants, audit] = await Promise.all([
      listEnterTenants(),
      listEnterTenantAudit(),
    ]);
    return NextResponse.json({
      ok: true,
      tenants,
      audit,
      packages: ENTERSYS_BASE_PACKAGES.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      moduleKeys: ENTERSYS_MODULE_KEYS,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
