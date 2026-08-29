import { type NextRequest, NextResponse } from "next/server";
import { requireEnterApi } from "@/lib/ops/access";
import type { OpsPovratStanje } from "@/lib/ops/schema";
import { lookupOpsJedinica, skenOpsJedinica } from "@/lib/ops/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  const kod = req.nextUrl.searchParams.get("kod") ?? "";
  try {
    const found = await lookupOpsJedinica(kod);
    if (!found) {
      return NextResponse.json({ ok: false, error: "KOD_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...found });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireEnterApi();
  if (auth.error) return auth.error;
  let body: {
    kod?: string;
    akcija?: "IZDATO" | "MONTAZA" | "POVRAT" | "SERVIS_GOTOVO";
    kompletacija_id?: number | null;
    osoba?: string;
    povrat_stanje?: OpsPovratStanje | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  try {
    const result = await skenOpsJedinica({
      kod: String(body.kod ?? ""),
      akcija: body.akcija ?? "IZDATO",
      kompletacija_id: body.kompletacija_id ? Number(body.kompletacija_id) : null,
      osoba: String(body.osoba ?? ""),
      povrat_stanje: body.povrat_stanje ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
