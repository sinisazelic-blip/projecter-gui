import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import {
  createOpsRadniNalog,
  listOpsRadnici,
  listOpsRadniNalozi,
} from "@/lib/ops/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  try {
    const [nalozi, radnici] = await Promise.all([
      listOpsRadniNalozi(),
      listOpsRadnici(),
    ]);
    return NextResponse.json({ ok: true, nalozi, radnici });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: {
    datum?: string;
    sablon_artikal_id?: number;
    kolicina?: number;
    sati?: number | null;
    radnik_id?: number | null;
    radnik_naziv?: string | null;
    napomena?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    const result = await createOpsRadniNalog({
      datum: String(body.datum ?? ""),
      sablon_artikal_id: Number(body.sablon_artikal_id),
      kolicina: Number(body.kolicina),
      sati: body.sati != null ? Number(body.sati) : null,
      radnik_id: body.radnik_id ? Number(body.radnik_id) : null,
      radnik_naziv: body.radnik_naziv,
      napomena: body.napomena,
    });
    const nalozi = await listOpsRadniNalozi();
    return NextResponse.json({ ok: true, ...result, nalozi });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
