import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import { createOpsNalogPosla, listOpsNaloziPosla } from "@/lib/ops/nalozi";
import { listOpsProjekti } from "@/lib/ops/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  const projekatId = Number(req.nextUrl.searchParams.get("projekat_id") ?? 0);
  try {
    const [nalozi, projekti] = await Promise.all([
      listOpsNaloziPosla(projekatId || undefined),
      listOpsProjekti(),
    ]);
    return NextResponse.json({ ok: true, nalozi, projekti });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: {
    projekat_id?: number;
    datum?: string;
    objekat?: string | null;
    voditelj_naziv?: string | null;
    datum_od?: string | null;
    datum_do?: string | null;
    napomena?: string | null;
    spec?: Array<{ artikal_id: number; kolicina: number }>;
    saas?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    const result = await createOpsNalogPosla({
      projekat_id: Number(body.projekat_id),
      datum: String(body.datum ?? ""),
      objekat: body.objekat,
      voditelj_naziv: body.voditelj_naziv,
      datum_od: body.datum_od,
      datum_do: body.datum_do,
      napomena: body.napomena,
      spec: Array.isArray(body.spec) ? body.spec : [],
      saas: Array.isArray(body.saas) ? body.saas : [],
    });
    const nalozi = await listOpsNaloziPosla();
    return NextResponse.json({ ok: true, ...result, nalozi });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
