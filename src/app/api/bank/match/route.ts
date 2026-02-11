import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST JSON: { batch_id: 1 }" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const batch_id = body?.batch_id != null ? Number(body.batch_id) : null;
    const limit = body?.limit != null ? Number(body.limit) : 1000;

    if (!batch_id || !Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "batch_id is required" },
        { status: 400 },
      );
    }

    const result = await withTransaction(async (conn) => {
      const [rules]: any = await conn.execute(
        `
        SELECT
          rule_id, priority, match_text, match_account, match_amount, match_is_fee,
          projekat_id, narucilac_id, kategorija
        FROM bank_tx_match_rule
        WHERE is_active = 1
        ORDER BY priority ASC, rule_id ASC
        `,
      );

      const [txs]: any = await conn.execute(
        `
        SELECT
          s.tx_id, s.amount, s.is_fee,
          s.counterparty, s.description, s.full_description
        FROM bank_tx_staging s
        LEFT JOIN bank_tx_match m ON m.tx_id = s.tx_id
        WHERE s.batch_id = ?
          AND m.tx_id IS NULL
        ORDER BY s.tx_id ASC
        LIMIT ?
        `,
        [batch_id, limit],
      );

      return { rules, txs };
    });

    return NextResponse.json({ ok: true, batch_id, limit, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
