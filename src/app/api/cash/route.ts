import { NextRequest, NextResponse } from "next/server";
import { assertOwner } from "@/lib/auth/owner";
import { computeBalance, createCashDraft, listCash } from "@/lib/cash/store";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    assertOwner(req);

    const items = listCash(500);
    const balance = computeBalance(items);

    return NextResponse.json({ ok: true, balance, items });
  } catch (e: any) {
    return jsonError(e.message || "SERVER_ERROR", e?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertOwner(req);

    const body = await req.json();

    const amount = Number(body?.amount);
    const direction = body?.direction;
    const currency = (body?.currency ?? "KM").toString();
    const note = (body?.note ?? "").toString();
    const projectId = body?.projectId ? String(body.projectId) : null;
    const date = body?.date ? String(body.date) : undefined;

    if (!Number.isFinite(amount) || amount <= 0) return jsonError("INVALID_AMOUNT");
    if (direction !== "IN" && direction !== "OUT") return jsonError("INVALID_DIRECTION");
    if (!currency) return jsonError("INVALID_CURRENCY");
    if (!note.trim()) return jsonError("NOTE_REQUIRED");

    const created = createCashDraft({
      date,
      amount,
      currency,
      direction,
      note,
      projectId,
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e: any) {
    return jsonError(e.message || "SERVER_ERROR", e?.status || 500);
  }
}
