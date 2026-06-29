import { NextRequest, NextResponse } from "next/server";
import { commitRasknjizavanje } from "@/lib/finance/rasknjizavanje/commit";
import type { CommitPayload } from "@/lib/finance/rasknjizavanje/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CommitPayload;
    const result = await commitRasknjizavanje(body);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
