import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/bank/rules/delete?rule_id=123
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rule_id = Number(searchParams.get("rule_id"));

    if (!Number.isFinite(rule_id) || rule_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid rule_id" },
        { status: 400 },
      );
    }

    await query(`DELETE FROM bank_tx_match_rule WHERE rule_id=?`, [rule_id]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
