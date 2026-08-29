import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import type { OpsKlasaRizika } from "@/lib/ops/schema";
import {
  createOpsKompletacija,
  listOpsKlijenti,
  listOpsKompletacijaStavke,
  listOpsKompletacije,
  listOpsProjekti,
  listOpsRadnici,
} from "@/lib/ops/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  const id = Number(req.nextUrl.searchParams.get("id") ?? 0);
  try {
    const [kompletacije, radnici, klijenti, projekti] = await Promise.all([
      listOpsKompletacije(),
      listOpsRadnici(),
      listOpsKlijenti(),
      listOpsProjekti(),
    ]);
    const stavke = id ? await listOpsKompletacijaStavke(id) : [];
    return NextResponse.json({
      ok: true,
      kompletacije,
      radnici,
      klijenti,
      projekti,
      stavke,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: {
    event_naziv?: string;
    klasa_rizika?: OpsKlasaRizika;
    projekat_id?: number | null;
    klijent_id?: number | null;
    klijent_naziv?: string | null;
    krajnji_klijent_id?: number | null;
    krajnji_klijent_naziv?: string | null;
    objekat?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    const result = await createOpsKompletacija({
      event_naziv: String(body.event_naziv ?? ""),
      klasa_rizika: (body.klasa_rizika ?? "OSTALO") as OpsKlasaRizika,
      projekat_id: body.projekat_id ? Number(body.projekat_id) : null,
      klijent_id: body.klijent_id ? Number(body.klijent_id) : null,
      klijent_naziv: body.klijent_naziv,
      krajnji_klijent_id: body.krajnji_klijent_id
        ? Number(body.krajnji_klijent_id)
        : null,
      krajnji_klijent_naziv: body.krajnji_klijent_naziv,
      objekat: body.objekat,
    });
    const kompletacije = await listOpsKompletacije();
    return NextResponse.json({ ok: true, ...result, kompletacije });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
