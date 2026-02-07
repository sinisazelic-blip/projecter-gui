import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const match_text = String(body?.match_text ?? "").trim();
    const match_is_fee =
      body?.match_is_fee === true || body?.match_is_fee === 1 ? 1 : 0;

    const projekat_id =
      body?.projekat_id != null && String(body?.projekat_id) !== ""
        ? Number(body.projekat_id)
        : null;

    const narucilac_id =
      body?.narucilac_id != null && String(body?.narucilac_id) !== ""
        ? Number(body.narucilac_id)
        : null;

    const kategorija = body?.kategorija != null && String(body.kategorija).trim() !== ""
      ? String(body.kategorija).trim()
      : null;

    // priority (manji broj = jače pravilo)
    let priority = Number(body?.priority ?? 50);
    if (!Number.isFinite(priority)) priority = 50;
    priority = Math.max(1, Math.min(9999, Math.floor(priority)));

    if (!match_text) {
      return NextResponse.json({ ok: false, error: "match_text is required" }, { status: 400 });
    }

    const res = await withTransaction(async (conn) => {
      // duplikat zaštita: isto match_text + is_fee + projekat + kategorija
      const [existing]: any = await conn.execute(
        `
        SELECT rule_id
        FROM bank_tx_match_rule
        WHERE is_active = 1
          AND match_text = ?
          AND COALESCE(match_is_fee,0) = ?
          AND COALESCE(projekat_id,0) = COALESCE(?,0)
          AND COALESCE(kategorija,'') = COALESCE(?, '')
        LIMIT 1
        `,
        [match_text, match_is_fee, projekat_id, kategorija]
      );

      if (Array.isArray(existing) && existing.length) {
        return { rule_id: existing[0].rule_id, created: false };
      }

      const [ins]: any = await conn.execute(
        `
        INSERT INTO bank_tx_match_rule
          (priority, is_active, match_text, match_is_fee, projekat_id, narucilac_id, kategorija)
        VALUES
          (?, 1, ?, ?, ?, ?, ?)
        `,
        [priority, match_text, match_is_fee, projekat_id, narucilac_id, kategorija]
      );

      return { rule_id: ins?.insertId ?? null, created: true };
    });

    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
