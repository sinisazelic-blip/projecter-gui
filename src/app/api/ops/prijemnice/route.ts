import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import {
  createOpsPrijemnica,
  listOpsDobavljaci,
  listOpsPrijemnice,
} from "@/lib/ops/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  try {
    const [prijemnice, dobavljaci] = await Promise.all([
      listOpsPrijemnice(),
      listOpsDobavljaci(),
    ]);
    return NextResponse.json({ ok: true, prijemnice, dobavljaci });
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
    dobavljac_id?: number | null;
    dobavljac_naziv?: string | null;
    racun?: string | null;
    napomena?: string | null;
    lines?: Array<{ artikal_id: number; kolicina: number }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    const result = await createOpsPrijemnica({
      datum: String(body.datum ?? ""),
      dobavljac_id: body.dobavljac_id ? Number(body.dobavljac_id) : null,
      dobavljac_naziv: body.dobavljac_naziv,
      racun: body.racun,
      napomena: body.napomena,
      lines: Array.isArray(body.lines) ? body.lines : [],
    });
    const prijemnice = await listOpsPrijemnice();
    return NextResponse.json({ ok: true, ...result, prijemnice });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
