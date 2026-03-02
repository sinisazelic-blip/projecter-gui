// GET: da li je owner konfigurisan + dužina (za debug, ne otkriva šifru)
// POST: provjera owner tokena (šifra iz .env FLUXA_OWNER_TOKEN)
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeEnvValue(val: string | undefined): string {
  if (val == null) return "";
  let s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Uklanja BOM, NBSP, i zamjenjuje „pametne” znakove (full-width plus, druge tačke) s ASCII verzijama */
function normalizeForCompare(s: string): string {
  return s
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u2024/g, ".") // one dot leader
    .replace(/\u00B7/g, ".") // middle dot
    .replace(/\uFF0B/g, "+") // full-width plus
    .trim();
}

function findFirstDiff(a: string, b: string): { index: number; codeA: number; codeB: number } | null {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) {
      return { index: i, codeA: a.charCodeAt(i), codeB: b.charCodeAt(i) };
    }
  }
  if (a.length !== b.length) {
    return { index: len, codeA: a.length > len ? a.charCodeAt(len) : -1, codeB: b.length > len ? b.charCodeAt(len) : -1 };
  }
  return null;
}

export async function GET() {
  const raw = process.env.FLUXA_OWNER_TOKEN;
  const expected = normalizeEnvValue(raw);
  return NextResponse.json({
    configured: expected.length > 0,
    expectedLength: expected.length,
  });
}

export async function POST(req: NextRequest) {
  const raw = process.env.FLUXA_OWNER_TOKEN;
  const expected = normalizeEnvValue(raw);

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "OWNER_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const tokenRaw = typeof body?.token === "string" ? body.token : "";
  const token = tokenRaw.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "MISSING_TOKEN" }, { status: 400 });
  }

  const expectedNorm = normalizeForCompare(expected);
  const tokenNorm = normalizeForCompare(token);
  const ok = tokenNorm === expectedNorm;

  if (ok) {
    return NextResponse.json({ ok: true });
  }

  const diff = findFirstDiff(expectedNorm, tokenNorm);
  return NextResponse.json({
    ok: false,
    error: "WRONG_TOKEN",
    debug:
      diff != null
        ? {
            diffIndex: diff.index,
            expectedCharCode: diff.codeA,
            gotCharCode: diff.codeB,
            hint:
              diff.codeA === 46 || diff.codeB === 46
                ? "Razlika na poziciji (možda tačka . vs drugi znak?)"
                : diff.codeA === 43 || diff.codeB === 43
                  ? "Razlika na poziciji (možda plus +?)"
                  : "Različiti znak na poziciji " + diff.index,
          }
        : { hint: "Dužine se razlikuju: expected " + expectedNorm.length + ", got " + tokenNorm.length },
  });
}
