import { NextResponse } from "next/server";
import { getCloseCheck } from "@/lib/projects/close";

function getIdFromUrl(req: Request): number | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // očekujemo: api / projects / {id} / close-check
    const i = parts.indexOf("projects");
    if (i === -1) return null;
    const raw = parts[i + 1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const projekatId = getIdFromUrl(req);
  if (!projekatId) {
    return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  }

  const check = await getCloseCheck(projekatId);
  if (!check) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...check }, { status: 200 });
}
