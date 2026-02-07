import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bank/rules
export async function GET() {
  try {
    const rows = await withTransaction(async (conn: any) => {
      const [r]: any = await conn.execute(
        `
        SELECT
          rule_id, priority, is_active,
          match_text, match_account, match_amount, match_is_fee,
          projekat_id, narucilac_id, kategorija,
          created_at
        FROM bank_tx_match_rule
        ORDER BY is_active DESC, priority ASC, rule_id DESC
        `
      );
      return r;
    });

    return NextResponse.json({ ok: true, rules: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// POST /api/bank/rules
// body: { priority?, is_active?, match_text?, match_account?, match_amount?, match_is_fee?, projekat_id?, narucilac_id?, kategorija? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const priority = Number(body?.priority ?? 100);
    const is_active = body?.is_active === false ? 0 : 1;

    const match_text = body?.match_text ?? null;
    const match_account = body?.match_account ?? null;
    const match_amount =
      body?.match_amount === null || body?.match_amount === undefined || body?.match_amount === ""
        ? null
        : Number(body?.match_amount);
    const match_is_fee =
      body?.match_is_fee === null || body?.match_is_fee === undefined
        ? null
        : (body?.match_is_fee ? 1 : 0);

    const projekat_id =
      body?.projekat_id === null || body?.projekat_id === undefined || body?.projekat_id === ""
        ? null
        : Number(body?.projekat_id);
    const narucilac_id =
      body?.narucilac_id === null || body?.narucilac_id === undefined || body?.narucilac_id === ""
        ? null
        : Number(body?.narucilac_id);
    const kategorija = body?.kategorija ?? null;

    if (!Number.isFinite(priority)) {
      return NextResponse.json({ ok: false, error: "Invalid priority" }, { status: 400 });
    }
    if (match_amount !== null && !Number.isFinite(match_amount)) {
      return NextResponse.json({ ok: false, error: "Invalid match_amount" }, { status: 400 });
    }
    if (projekat_id !== null && !Number.isFinite(projekat_id)) {
      return NextResponse.json({ ok: false, error: "Invalid projekat_id" }, { status: 400 });
    }
    if (narucilac_id !== null && !Number.isFinite(narucilac_id)) {
      return NextResponse.json({ ok: false, error: "Invalid narucilac_id" }, { status: 400 });
    }

    const out = await withTransaction(async (conn: any) => {
      const [ins]: any = await conn.execute(
        `
        INSERT INTO bank_tx_match_rule
          (priority, is_active, match_text, match_account, match_amount, match_is_fee,
           projekat_id, narucilac_id, kategorija)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        ]
      );

      const rule_id = ins?.insertId ?? null;

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
        [rule_id]
      );

      return rows?.[0] ?? null;
    });

    return NextResponse.json({ ok: true, rule: out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
