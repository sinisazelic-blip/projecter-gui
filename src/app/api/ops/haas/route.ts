import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import {
  listOpsHaasCjenovnik,
  listOpsHaasFakture,
  previewOpsHaas,
  upsertOpsHaasCijena,
} from "@/lib/ops/haas";
import { listOpsKlijenti, listOpsKompletacije } from "@/lib/ops/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  const komplId = Number(req.nextUrl.searchParams.get("kompletacija_id") ?? 0);
  const valuta = req.nextUrl.searchParams.get("valuta") === "EUR" ? "EUR" : "BAM";
  try {
    const [cjenovnik, fakture, kompletacije, klijenti] = await Promise.all([
      listOpsHaasCjenovnik(),
      listOpsHaasFakture(),
      listOpsKompletacije(),
      listOpsKlijenti(),
    ]);
    const preview = komplId ? await previewOpsHaas(komplId, valuta) : null;
    return NextResponse.json({
      ok: true,
      cjenovnik,
      fakture,
      kompletacije,
      klijenti,
      preview,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: { artikal_id?: number; cijena_bam?: number; cijena_eur?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    await upsertOpsHaasCijena({
      artikal_id: Number(body.artikal_id),
      cijena_bam: Number(body.cijena_bam),
      cijena_eur: Number(body.cijena_eur),
    });
    const cjenovnik = await listOpsHaasCjenovnik();
    return NextResponse.json({ ok: true, cjenovnik });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function POST() {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  return NextResponse.json(
    {
      ok: false,
      error: "HAAS_FAKTURA_ZABRANJENA",
      message:
        "HaaS se ne fakturiše posebno. Račun ide samo kroz wizard, nakon što Deal zatvori posao.",
    },
    { status: 409 },
  );
}
