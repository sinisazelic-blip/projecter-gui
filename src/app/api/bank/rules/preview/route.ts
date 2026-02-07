import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/bank/rules/preview
// body: { rule_id?: number, rule?: { ...fields }, batch_id?: number }
// - ako proslediš rule_id: učita iz baze
// - ako proslediš rule: koristi ga direktno (za "dok kucaš" u UI)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const batch_id =
      body?.batch_id === null || body?.batch_id === undefined || body?.batch_id === ""
        ? null
        : Number(body?.batch_id);

    if (batch_id !== null && (!Number.isFinite(batch_id) || batch_id <= 0)) {
      return NextResponse.json({ ok: false, error: "Invalid batch_id" }, { status: 400 });
    }

    const out = await withTransaction(async (conn: any) => {
      let rule = body?.rule ?? null;

      const rule_id =
        body?.rule_id === null || body?.rule_id === undefined || body?.rule_id === ""
          ? null
          : Number(body?.rule_id);

      if (!rule && rule_id) {
        const [rows]: any = await conn.execute(
          `
          SELECT
            rule_id, priority, is_active,
            match_text, match_account, match_amount, match_is_fee,
            projekat_id, narucilac_id, kategorija
          FROM bank_tx_match_rule
          WHERE rule_id = ?
          LIMIT 1
          `,
          [rule_id]
        );
        rule = rows?.[0] ?? null;
      }

      if (!rule) {
        return { ok: false, error: "RULE_MISSING" as const };
      }

      // build WHERE uslovi (MVP)
      const where: string[] = [];
      const params: any[] = [];

      if (batch_id !== null) {
        where.push("t.batch_id = ?");
        params.push(batch_id);
      }

      if (rule.match_text) {
        where.push("(t.description LIKE ? OR t.counterparty LIKE ?)");
        params.push(`%${rule.match_text}%`, `%${rule.match_text}%`);
      }

      if (rule.match_account) {
        // pretpostavka: staging ima account_id ili account_ref/iban; kod tebe je batch vezan za account_id u batch tabeli,
        // ali staging ima t.batch_id pa je dovoljno. Ovo je optional filter.
        where.push("t.account_id = ?");
        params.push(rule.match_account);
      }

      if (rule.match_amount !== null && rule.match_amount !== undefined && rule.match_amount !== "") {
        where.push("t.amount = ?");
        params.push(Number(rule.match_amount));
      }

      if (rule.match_is_fee !== null && rule.match_is_fee !== undefined && rule.match_is_fee !== "") {
        // MVP: fee = kategorija/description sadrži "Provizija" ili kategorija == 'Provizija'
        // (ovo kasnije može biti bolje)
        if (Number(rule.match_is_fee) === 1) {
          where.push("(t.description LIKE '%proviz%' OR t.description LIKE '%fee%' OR t.counterparty LIKE '%bank%' OR t.amount <> 0)");
        } else {
          // no-op (teško definisati negaciju fee-a u MVP)
        }
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [cntRows]: any = await conn.execute(
        `
        SELECT COUNT(*) AS cnt
        FROM bank_tx_staging t
        ${whereSql}
        `,
        params
      );

      const count = Number(cntRows?.[0]?.cnt ?? 0);

      const [sample]: any = await conn.execute(
        `
        SELECT t.tx_id, t.value_date, t.amount, t.currency, t.counterparty, LEFT(COALESCE(t.description,''),255) AS description
        FROM bank_tx_staging t
        ${whereSql}
        ORDER BY t.tx_id DESC
        LIMIT 20
        `,
        params
      );

      return { ok: true, count, sample };
    });

    if (!out.ok && out.error === "RULE_MISSING") {
      return NextResponse.json({ ok: false, error: "RULE_MISSING" }, { status: 400 });
    }

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
