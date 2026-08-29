import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import {
  createOpsArtikal,
  listOpsCatalog,
  replaceOpsSastavnica,
  updateOpsArtikal,
} from "@/lib/ops/queries";
import type { OpsArtikalVrsta } from "@/lib/ops/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  try {
    const data = await listOpsCatalog();
    return NextResponse.json({ ok: true, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: {
    sifra?: string;
    naziv?: string;
    vrsta?: OpsArtikalVrsta;
    jm_id?: number;
    default_magacin_id?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    const artikal_id = await createOpsArtikal({
      sifra: String(body.sifra ?? ""),
      naziv: String(body.naziv ?? ""),
      vrsta: (body.vrsta ?? "MATERIJAL") as OpsArtikalVrsta,
      jm_id: Number(body.jm_id),
      default_magacin_id: body.default_magacin_id
        ? Number(body.default_magacin_id)
        : undefined,
    });
    const data = await listOpsCatalog();
    return NextResponse.json({ ok: true, artikal_id, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: {
    artikal_id?: number;
    naziv?: string;
    vrsta?: OpsArtikalVrsta;
    jm_id?: number;
    default_magacin_id?: number;
    aktivan?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  const id = Number(body.artikal_id);
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID_REQUIRED" }, { status: 400 });
  }
  try {
    await updateOpsArtikal(id, body);
    const data = await listOpsCatalog();
    return NextResponse.json({ ok: true, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: {
    sablon_artikal_id?: number;
    lines?: Array<{ komponenta_artikal_id: number; kolicina: number }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  const sablonId = Number(body.sablon_artikal_id);
  if (!sablonId) {
    return NextResponse.json({ ok: false, error: "SABLON_REQUIRED" }, { status: 400 });
  }
  try {
    await replaceOpsSastavnica(sablonId, Array.isArray(body.lines) ? body.lines : []);
    const data = await listOpsCatalog();
    return NextResponse.json({ ok: true, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
