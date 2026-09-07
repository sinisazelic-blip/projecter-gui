import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import {
  createOpsRdn,
  listOpsRdn,
  predloziOtpisIzRadionice,
} from "@/lib/ops/nalozi";
import { listOpsRadnici } from "@/lib/ops/queries";
import type { RdnVrsta } from "@/lib/ops/process";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  try {
    const [nalozi, radnici] = await Promise.all([listOpsRdn(), listOpsRadnici()]);
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
    action?: string;
    vrsta?: RdnVrsta;
    datum?: string;
    sablon_artikal_id?: number | null;
    jedinica_id?: number | null;
    kolicina?: number;
    sati?: number | null;
    radnik_id?: number | null;
    radnik_naziv?: string | null;
    napomena?: string | null;
    osoba?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    if (body.action === "OTPIS") {
      await predloziOtpisIzRadionice({
        jedinica_id: Number(body.jedinica_id),
        osoba: String(body.osoba || body.radnik_naziv || ""),
        napomena: body.napomena,
      });
      return NextResponse.json({ ok: true });
    }
    const result = await createOpsRdn({
      vrsta: body.vrsta === "SERVIS" ? "SERVIS" : "SKLAPANJE",
      datum: String(body.datum ?? ""),
      sablon_artikal_id: body.sablon_artikal_id,
      jedinica_id: body.jedinica_id,
      kolicina: body.kolicina,
      sati: body.sati,
      radnik_id: body.radnik_id,
      radnik_naziv: body.radnik_naziv,
      napomena: body.napomena,
    });
    const nalozi = await listOpsRdn();
    return NextResponse.json({ ok: true, ...result, nalozi });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
