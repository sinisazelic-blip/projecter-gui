import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";

export async function handleBankCostsRollback(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const batchId = Number((body as any)?.batch_id);
    const dryRun = Boolean((body as any)?.dry_run);

    if (!Number.isFinite(batchId) || batchId <= 0) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BATCH_ID" },
        { status: 400 },
      );
    }

    const result = await withTransaction(async (conn: any) => {
      // 1) Lock batch
      const [batchRows]: any = await conn.execute(
        `SELECT batch_id, status
         FROM bank_import_batch
         WHERE batch_id = ?
         FOR UPDATE`,
        [batchId],
      );

      if (!batchRows?.length) {
        // throw da izadjemo iz transaction wrappera kontrolisano
        return {
          __http: 404,
          payload: { ok: false, error: "BATCH_NOT_FOUND", batch_id: batchId },
        };
      }

      // 2) Gate: linkovi su "anchor" za rollback
      const [gateRows]: any = await conn.execute(
        `SELECT COUNT(*) AS links_gate
         FROM bank_tx_cost_link
         WHERE batch_id = ?
         FOR UPDATE`,
        [batchId],
      );
      const linksGate = Number(gateRows?.[0]?.links_gate || 0);

      // 3) Pre-counts (za response / dry_run)
      const [linksRows]: any = await conn.execute(
        `SELECT COUNT(*) AS links_total
         FROM bank_tx_cost_link
         WHERE batch_id = ?`,
        [batchId],
      );
      const linksTotal = Number(linksRows?.[0]?.links_total || 0);

      const [costsRows]: any = await conn.execute(
        `SELECT COUNT(*) AS costs_total
         FROM projektni_troskovi pt
         JOIN bank_tx_cost_link l ON l.trosak_row_id = pt.trosak_id
         WHERE l.batch_id = ?`,
        [batchId],
      );
      const costsTotal = Number(costsRows?.[0]?.costs_total || 0);

      const [postingsRows]: any = await conn.execute(
        `SELECT
           COUNT(*) AS postings_total,
           SUM(reversed_at IS NULL) AS postings_not_reversed
         FROM bank_tx_posting
         WHERE batch_id = ?`,
        [batchId],
      );
      const postingsTotal = Number(postingsRows?.[0]?.postings_total || 0);
      const postingsNotReversed = Number(
        postingsRows?.[0]?.postings_not_reversed || 0,
      );

      // DRY RUN: samo vrati šta bi se desilo (wrapper će rollbackovati svejedno)
      if (dryRun) {
        return {
          __http: 200,
          payload: {
            ok: true,
            batch_id: batchId,
            dry_run: true,
            links_total: linksTotal,
            costs_total: costsTotal,
            postings_total: postingsTotal,
            postings_not_reversed: postingsNotReversed,
            message:
              linksGate > 0 ? "Rollback available" : "Nothing to rollback",
          },
        };
      }

      // Idempotent: nema linkova => nema šta rollbackovati
      if (linksGate === 0) {
        return {
          __http: 200,
          payload: {
            ok: true,
            batch_id: batchId,
            dry_run: false,
            postings_reversed: 0,
            costs_deleted: 0,
            links_deleted: 0,
            batch_status: String(batchRows?.[0]?.status ?? ""),
            message: "Nothing to rollback",
          },
        };
      }

      // 4) Soft reverse postings (idempotentno)
      const [updPostings]: any = await conn.execute(
        `UPDATE bank_tx_posting
         SET reversed_at = NOW(),
             reversed_by_batch_id = ?
         WHERE batch_id = ?
           AND reversed_at IS NULL`,
        [batchId, batchId],
      );

      // 5) Delete costs preko link tabele
      const [delCosts]: any = await conn.execute(
        `DELETE pt
         FROM projektni_troskovi pt
         JOIN bank_tx_cost_link l ON l.trosak_row_id = pt.trosak_id
         WHERE l.batch_id = ?`,
        [batchId],
      );

      // 6) Delete links
      const [delLinks]: any = await conn.execute(
        `DELETE FROM bank_tx_cost_link
         WHERE batch_id = ?`,
        [batchId],
      );

      // 7) Batch status
      await conn.execute(
        `UPDATE bank_import_batch
         SET status = 'reverted'
         WHERE batch_id = ?`,
        [batchId],
      );

      return {
        __http: 200,
        payload: {
          ok: true,
          batch_id: batchId,
          dry_run: false,
          postings_reversed: updPostings?.affectedRows || 0,
          costs_deleted: delCosts?.affectedRows || 0,
          links_deleted: delLinks?.affectedRows || 0,
          batch_status: "reverted",
        },
      };
    });

    // unify response
    if (result?.payload) {
      return NextResponse.json(result.payload, {
        status: result.__http ?? 200,
      });
    }
    // fallback (ne bi trebalo)
    return NextResponse.json(result);
  } catch (err) {
    console.error("rollback error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
