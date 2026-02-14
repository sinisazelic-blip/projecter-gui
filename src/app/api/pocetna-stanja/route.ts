import { NextResponse } from "next/server";
import { getPocetnaStanja } from "@/lib/pocetna-stanja";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPocetnaStanja();
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
