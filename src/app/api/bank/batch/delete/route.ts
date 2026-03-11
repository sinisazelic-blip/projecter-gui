import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Briše jedan izvod (batch) i sve povezane podatke:
 * linkovi prihod/placanje, cost_link, izvedeni prihodi/plaćanja/troškovi,
 * posting, match, staging, batch.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const batch_id = Number((body as any)?.batch_id);

    if (!Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan batch_id" },
        { status: 400 },
      );
    }

    await withTransaction(async (conn: any) => {
      // 1) Izvedeni entiteti (prihodi/plaćanja) povezani preko postings ovog batcha
      await conn.execute(
        `DELETE pp FROM projektni_prihodi pp
         INNER JOIN bank_tx_posting_prihod_link l ON l.prihod_id = pp.prihod_id
         INNER JOIN bank_tx_posting p ON p.posting_id = l.posting_id
         WHERE p.batch_id = ?`,
        [batch_id],
      );
      await conn.execute(
        `DELETE pl FROM placanja pl
         INNER JOIN bank_tx_posting_placanje_link l ON l.placanje_id = pl.placanje_id
         INNER JOIN bank_tx_posting p ON p.posting_id = l.posting_id
         WHERE p.batch_id = ?`,
        [batch_id],
      );

      // 2) Link tabele (posting -> prihod/placanje) — subquery u derived table zbog MySQL
      await conn.execute(
        `DELETE FROM bank_tx_posting_prihod_link
         WHERE posting_id IN (SELECT p.posting_id FROM (SELECT posting_id FROM bank_tx_posting WHERE batch_id = ?) AS p)`,
        [batch_id],
      );
      await conn.execute(
        `DELETE FROM bank_tx_posting_placanje_link
         WHERE posting_id IN (SELECT p.posting_id FROM (SELECT posting_id FROM bank_tx_posting WHERE batch_id = ?) AS p)`,
        [batch_id],
      );

      // 3) Troškovi nastali iz ovog batcha + cost_link
      await conn.execute(
        `DELETE pt FROM projektni_troskovi pt
         INNER JOIN bank_tx_cost_link l ON l.trosak_row_id = pt.trosak_id
         WHERE l.batch_id = ?`,
        [batch_id],
      );
      await conn.execute(
        `DELETE FROM bank_tx_cost_link WHERE batch_id = ?`,
        [batch_id],
      );

      // 4) Posting, match, staging, batch
      await conn.execute(
        `DELETE FROM bank_tx_posting WHERE batch_id = ?`,
        [batch_id],
      );
      await conn.execute(
        `DELETE m FROM bank_tx_match m
         INNER JOIN bank_tx_staging s ON s.tx_id = m.tx_id
         WHERE s.batch_id = ?`,
        [batch_id],
      );
      await conn.execute(
        `DELETE FROM bank_tx_staging WHERE batch_id = ?`,
        [batch_id],
      );
      const [delBatch]: any = await conn.execute(
        `DELETE FROM bank_import_batch WHERE batch_id = ?`,
        [batch_id],
      );

      if (delBatch?.affectedRows !== 1) {
        throw new Error("Izvod nije pronađen ili je već obrisan.");
      }
    });

    return NextResponse.json({ ok: true, batch_id });
  } catch (e: any) {
    console.error("batch delete error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška pri brisanju izvoda" },
      { status: 500 },
    );
  }
}
