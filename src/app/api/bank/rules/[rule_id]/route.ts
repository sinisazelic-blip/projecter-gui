import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asIntOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// PUT /api/bank/rules/:rule_id
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ rule_id: string }> },
) {
  try {
    const { rule_id: rawRuleId } = await ctx.params;
    const rule_id = Number(rawRuleId);

    if (!Number.isFinite(rule_id) || rule_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid rule_id" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));

    const priority = Number(body?.priority ?? 100);
    const is_active = body?.is_active === false ? 0 : 1;

    const match_text = body?.match_text ?? null;
    const match_account = body?.match_account ?? null;
    const match_amount = asIntOrNull(body?.match_amount);
    const match_is_fee =
      body?.match_is_fee === null || body?.match_is_fee === undefined
        ? null
        : body?.match_is_fee
          ? 1
          : 0;

    const projekat_id = asIntOrNull(body?.projekat_id);
    const narucilac_id = asIntOrNull(body?.narucilac_id);
    const kategorija = body?.kategorija ?? null;

    if (!Number.isFinite(priority)) {
      return NextResponse.json(
        { ok: false, error: "Invalid priority" },
        { status: 400 },
      );
    }
    if (match_amount !== null && Number.isNaN(match_amount)) {
      return NextResponse.json(
        { ok: false, error: "Invalid match_amount" },
        { status: 400 },
      );
    }
    if (projekat_id !== null && Number.isNaN(projekat_id)) {
      return NextResponse.json(
        { ok: false, error: "Invalid projekat_id" },
        { status: 400 },
      );
    }
    if (narucilac_id !== null && Number.isNaN(narucilac_id)) {
      return NextResponse.json(
        { ok: false, error: "Invalid narucilac_id" },
        { status: 400 },
      );
    }

    const out = await withTransaction(async (conn: any) => {
      const [ex]: any = await conn.execute(
        `SELECT rule_id FROM bank_tx_match_rule WHERE rule_id = ? LIMIT 1`,
        [rule_id],
      );
      if (!Array.isArray(ex) || ex.length === 0) {
        return { ok: false, error: "RULE_NOT_FOUND" as const };
      }

      await conn.execute(
        `
        UPDATE bank_tx_match_rule
        SET
          priority = ?,
          is_active = ?,
          match_text = ?,
          match_account = ?,
          match_amount = ?,
          match_is_fee = ?,
          projekat_id = ?,
          narucilac_id = ?,
          kategorija = ?
        WHERE rule_id = ?
        `,
        [
          priority,
          is_active,
          match_text,
          match_account,
          match_amount,
          match_is_fee,
          projekat_id,
          narucilac_id,
          kategorija,
          rule_id,
        ],
      );

      const [rows]: any = await conn.execute(
        `
        SELECT
          rule_id, priority, is_active,
          match_text, match_account, match_amount, match_is_fee,
          projekat_id, narucilac_id, kategorija,
          created_at
        FROM bank_tx_match_rule
        WHERE rule_id = ?
        LIMIT 1
        `,
        [rule_id],
      );

      return { ok: true, rule: rows?.[0] ?? null };
    });

    if (!out.ok && out.error === "RULE_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "RULE_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/bank/rules/:rule_id
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ rule_id: string }> },
) {
  try {
    const { rule_id: rawRuleId } = await ctx.params;
    const rule_id = Number(rawRuleId);

    if (!Number.isFinite(rule_id) || rule_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid rule_id" },
        { status: 400 },
      );
    }

    const out = await withTransaction(async (conn: any) => {
      const [ins]: any = await conn.execute(
        `DELETE FROM bank_tx_match_rule WHERE rule_id = ?`,
        [rule_id],
      );
      const affected = Number(ins?.affectedRows ?? 0);
      return { ok: true, deleted: affected };
    });

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
