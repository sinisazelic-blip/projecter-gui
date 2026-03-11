import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { findFakturaFromText } from "@/lib/bank/matchInvoiceFromText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// handler za /api/bank/commit
// body: { batch_id: number }
export async function handleBankCommit(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const batch_id = Number((body as any)?.batch_id);

    if (!Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid batch_id", marker: "COMMIT_V2_UPSERT" },
        { status: 400 },
      );
    }

    const result = await withTransaction(async (conn: any) => {
      // 0) provjera batch + account_id
      const [brows]: any = await conn.execute(
        `SELECT batch_id, account_id FROM bank_import_batch WHERE batch_id = ? LIMIT 1`,
        [batch_id],
      );

      if (!Array.isArray(brows) || brows.length === 0) {
        return {
          ok: false,
          error: `Batch ${batch_id} ne postoji`,
          code: "BATCH_NOT_FOUND",
        };
      }

      const account_id = brows[0]?.account_id ?? null;

      // 1) unmatched provjera
      const [unmRows]: any = await conn.execute(
        `
        SELECT COUNT(*) AS cnt
        FROM bank_tx_staging t
        LEFT JOIN bank_tx_match m ON m.tx_id = t.tx_id
        WHERE t.batch_id = ?
          AND m.tx_id IS NULL
        `,
        [batch_id],
      );

      const unmatched_cnt = Number(unmRows?.[0]?.cnt ?? 0);
      if (unmatched_cnt > 0) {
        return {
          ok: false,
          error: `Batch ima unmatched stavke: ${unmatched_cnt}`,
          code: "HAS_UNMATCHED",
        };
      }

      // 2) UPSERT: insert ili update po tx_id (UNIQUE na bank_tx_posting.tx_id)
      const [up]: any = await conn.execute(
        `
        INSERT INTO bank_tx_posting
          (tx_id, batch_id, account_id, value_date, amount, currency,
           projekat_id, kategorija, counterparty, description, matched_by, rule_id)
        SELECT
          t.tx_id,
          t.batch_id,
          ? AS account_id,
          COALESCE(t.value_date, CURDATE()) AS value_date,
          t.amount,
          COALESCE(t.currency, 'BAM') AS currency,
          m.projekat_id,
          m.kategorija,
          t.counterparty,
          LEFT(COALESCE(t.description, ''), 255) AS description,
          m.matched_by,
          NULL AS rule_id
        FROM bank_tx_staging t
        JOIN bank_tx_match m ON m.tx_id = t.tx_id
        WHERE t.batch_id = ?
        ON DUPLICATE KEY UPDATE
          batch_id     = VALUES(batch_id),
          account_id   = VALUES(account_id),
          value_date   = VALUES(value_date),
          amount       = VALUES(amount),
          currency     = VALUES(currency),
          projekat_id  = VALUES(projekat_id),
          kategorija   = VALUES(kategorija),
          counterparty = VALUES(counterparty),
          description  = VALUES(description),
          matched_by   = VALUES(matched_by),
          rule_id      = VALUES(rule_id)
        `,
        [account_id, batch_id],
      );

      const affected_rows = Number(up?.affectedRows ?? 0);

      // 3) status -> posted
      await conn.execute(
        `UPDATE bank_import_batch SET status = 'posted' WHERE batch_id = ?`,
        [batch_id],
      );

      // 4) Auto-uparivanje uplata na fakture: iz teksta (poziv na broj ili broj fakture 001/2026)
      let matched_invoices = 0;
      try {
        const [postings]: any = await conn.execute(
          `
          SELECT p.posting_id, p.description, p.amount, p.value_date
          FROM bank_tx_posting p
          LEFT JOIN bank_tx_posting_prihod_link l ON l.posting_id = p.posting_id AND l.aktivan = 1
          WHERE p.batch_id = ? AND p.amount > 0 AND l.link_id IS NULL
          `,
          [batch_id],
        );
        const list = Array.isArray(postings) ? postings : [];
        for (const row of list) {
          const description = row?.description ?? "";
          const amount = Number(row?.amount);
          const valueDate = row?.value_date;
          const postingId = row?.posting_id;
          if (!Number.isFinite(amount) || amount <= 0 || !postingId) continue;

          const fakturaMatch = await findFakturaFromText(conn, description, null);
          if (!fakturaMatch || fakturaMatch.projekat_id <= 0) continue;

          const datum = valueDate ? String(valueDate).slice(0, 10) : null;
          if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;

          const amountKm = Math.round(amount * 100) / 100;
          let prihodId: number | null = null;
          try {
            const [ins]: any = await conn.execute(
              `INSERT INTO projektni_prihodi (projekat_id, faktura_id, datum, iznos_km, opis, status)
               VALUES (?, ?, ?, ?, ?, 'NASTALO')`,
              [fakturaMatch.projekat_id, fakturaMatch.faktura_id, datum, amountKm, (description || "Uplata po izvodu").slice(0, 255)],
            );
            prihodId = ins?.insertId ?? null;
          } catch {
            try {
              const [ins2]: any = await conn.execute(
                `INSERT INTO projektni_prihodi (projekat_id, datum, iznos_km, opis) VALUES (?, ?, ?, ?)`,
                [fakturaMatch.projekat_id, datum, amountKm, description.slice(0, 255) || "Uplata po izvodu"],
              );
              prihodId = ins2?.insertId ?? null;
            } catch {
              continue;
            }
          }
          if (!prihodId) continue;

          await conn.execute(
            `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan, created_at) VALUES (?, ?, ?, 1, NOW())`,
            [postingId, prihodId, amountKm],
          );
          await conn.execute(
            `UPDATE fakture SET fiskalni_status = 'PLACENA' WHERE faktura_id = ?`,
            [fakturaMatch.faktura_id],
          );
          matched_invoices += 1;
        }
      } catch (autoMatchErr: any) {
        console.warn("[bankCommit] auto-match invoices:", autoMatchErr?.message);
      }

      return {
        ok: true,
        batch_id,
        account_id,
        affected_rows,
        matched_invoices,
        status: "posted",
        marker: "COMMIT_V2_UPSERT",
      };
    });

    if (!result.ok)
      return NextResponse.json(
        { ...result, marker: "COMMIT_V2_UPSERT" },
        { status: 400 },
      );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Server error",
        marker: "COMMIT_V2_UPSERT",
      },
      { status: 500 },
    );
  }
}
