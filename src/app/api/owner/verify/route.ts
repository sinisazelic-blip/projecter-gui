import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const expected = process.env.FLUXA_OWNER_TOKEN;

/** GET: vrati da li je owner konfigurisan i dužinu tokena (za hint) */
export async function GET() {
  if (!expected || expected.length === 0) {
    return NextResponse.json(
      { configured: false, error: "OWNER_NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  return NextResponse.json({
    configured: true,
    expectedLength: expected.length,
  });
}

/** POST: provjeri token, vrati ok ako odgovara */
export async function POST(req: NextRequest) {
  if (!expected || expected.length === 0) {
    return NextResponse.json(
      { ok: false, error: "OWNER_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const got = String(body?.token ?? "").trim();
  if (got === expected) {
    return NextResponse.json({ ok: true });
  }

  // Debug hint za sličnost (bez otkrivanja tokena)
  let debug: { hint?: string; diffIndex?: number; expectedCharCode?: number; gotCharCode?: number } | undefined;
  if (got.length !== expected.length) {
    debug = { hint: `Dužina: uneseno ${got.length}, očekivano ${expected.length}.` };
  } else {
    for (let i = 0; i < expected.length; i++) {
      if (got[i] !== expected[i]) {
        debug = {
          diffIndex: i,
          expectedCharCode: expected.charCodeAt(i),
          gotCharCode: got.charCodeAt(i),
        };
        break;
      }
    }
  }

  return NextResponse.json({ ok: false, debug }, { status: 401 });
}
