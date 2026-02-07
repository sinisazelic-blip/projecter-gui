import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST JSON: { batch_id: number, limit?: number }"
  });
}

type RuleRow = {
  rule_id: number;
  priority: number;
  match_text: string | null;
  match_account: string | null;
  match_amount: any | null;
  match_is_fee: any | null;
  projekat_id: number | null;
  narucilac_id: number | null;
  kategorija: string | null;
};

type TxRow = {
  tx_id: number;
  amount: any;
  is_fee: any;
  counterparty: string | null;
  description: string | null;
  full_description: string | null;
};

function norm(v: any): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function round2(n: any): number | null {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}

function matchesRule(tx: TxRow, r: RuleRow): boolean {
  const txAmount = round2(tx.amount);
  const txIsFee = Number(tx.is_fee) === 1;

  if (r.match_amount !== null && r.match_amount !== undefined) {
    const ra = round2(r.match_amount);
    if (ra == null || txAmount == null || ra !== txAmount) return false;
  }

  if (r.match_is_fee !== null && r.match_is_fee !== undefined) {
    const ris = Number(r.match_is_fee) === 1;
    if (ris !== txIsFee) return false;
  }

  const haystack = [
    norm(tx.full_description),
    norm(tx.description),
    norm(tx.counterparty),
  ].join(" | ");

  if (r.match_account) {
    const needle = norm(r.match_account);
    if (!needle || !haystack.includes(needle)) return false;
  }

  if (r.match_text) {
    const needle = norm(r.match_text);
    if (!needle || !haystack.includes(needle)) return false;
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1) batch_id može doći iz query param ili iz JSON body
    const qp = req.nextUrl.searchParams.get("batch_id");
    let body: any = {};
    if (!qp) body = await req.json().catch(() => ({}));

    const batch_id = Number(qp ?? body?.batch_id);

    // limit može doći iz query ili body
    const limitRaw = req.nextUrl.searchParams.get("limit") ?? body?.limit ?? 1000;
    let limit = Number(limitRaw);
    if (!Number.isFinite(limit)) limit = 1000;
    limit = Math.max(1, Math.min(5000, Math.floor(limit)));

    if (!Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json({ ok: false, error: "batch_id is required" }, { status: 400 });
    }

    const result = await withTransaction(async (conn) => {
      const [rulesRaw]: any = await conn.execute(
        `
        SELECT
          rule_id, priority,
          match_text, match_account, match_amount, match_is_fee,
          projekat_id, narucilac_id, kategorija
        FROM bank_tx_match_rule
        WHERE is_active = 1
        ORDER BY priority ASC, rule_id ASC
        `
      );
      const rules: RuleRow[] = (rulesRaw ?? []) as RuleRow[];

      const [txsRaw]: any = await conn.execute(
        `
        SELECT
          s.tx_id, s.amount, s.is_fee,
          s.counterparty, s.description, s.full_description
        FROM bank_tx_staging s
        LEFT JOIN bank_tx_match m ON m.tx_id = s.tx_id
        WHERE s.batch_id = ?
          AND m.tx_id IS NULL
        ORDER BY s.tx_id ASC
        LIMIT ${limit}
        `,
        [batch_id]
      );
      const txs: TxRow[] = (txsRaw ?? []) as TxRow[];

      let matched = 0;
      const items: any[] = [];

      for (const tx of txs) {
        let hit: RuleRow | null = null;

        for (const r of rules) {
          if (matchesRule(tx, r)) {
            hit = r;
            break;
          }
        }

        if (!hit) continue;

        await conn.execute(
          `
          INSERT INTO bank_tx_match
            (tx_id, projekat_id, narucilac_id, kategorija, matched_by)
          VALUES
            (?, ?, ?, ?, 'AUTO')
          `,
          [tx.tx_id, hit.projekat_id ?? null, hit.narucilac_id ?? null, hit.kategorija ?? null]
        );

        matched++;
        items.push({
          tx_id: tx.tx_id,
          rule_id: hit.rule_id,
          projekat_id: hit.projekat_id ?? null,
          narucilac_id: hit.narucilac_id ?? null,
          kategorija: hit.kategorija ?? null,
        });
      }

      return {
        batch_id,
        scanned: txs.length,
        rules: rules.length,
        matched,
        items,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
