import { NextResponse } from "next/server";
import { computeNextInvoiceNumbers } from "@/lib/fakture/next-invoice-numbers";

export const dynamic = "force-dynamic";

function parseGodina(req: Request): number | null {
  const url = new URL(req.url);
  const godinaRaw = url.searchParams.get("godina");
  if (godinaRaw) {
    const y = Number(godinaRaw);
    return Number.isFinite(y) && y >= 2000 && y <= 2100 ? Math.trunc(y) : null;
  }
  const dateRaw = url.searchParams.get("date");
  if (dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw.slice(0, 10))) {
    return Number(dateRaw.slice(0, 4));
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const godina = parseGodina(req);
    if (!godina) {
      return NextResponse.json(
        { ok: false, error: "Nedostaje godina ili date (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const pfrLastRaw = String(url.searchParams.get("pfr_last") ?? "").trim();
    let pfrLastManual: number | null = null;
    if (pfrLastRaw !== "") {
      const n = Number(pfrLastRaw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { ok: false, error: "pfr_last mora biti nenegativan broj" },
          { status: 400 },
        );
      }
      pfrLastManual = Math.trunc(n);
    }

    const numbers = await computeNextInvoiceNumbers(godina, pfrLastManual);

    return NextResponse.json({ ok: true, ...numbers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
