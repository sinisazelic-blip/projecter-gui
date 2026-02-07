import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  // detalj
  if (id) {
    const batch_id = Number(id);
    if (!Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid batch id" }, { status: 400 });
    }

    const batchRows: any[] = await query(
      `
      SELECT
        batch_id, account_id, source, upp_id, bank_account_no, tax_id, company_name,
        statement_no,
        DATE_FORMAT(statement_date, '%Y-%m-%d') AS statement_date,
        currency, opening_balance, closing_balance, total_debit, total_credit,
        file_hash, imported_at
      FROM bank_import_batch
      WHERE batch_id = ?
      LIMIT 1
      `,
      [batch_id]
    );

    if (!batchRows.length) {
      return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
    }

    const txs: any[] = await query(
      `
      SELECT
        tx_id, batch_id, tx_hash, reference,
        DATE_FORMAT(value_date, '%Y-%m-%d') AS value_date,
        amount, currency,
        counterparty, counterparty_bank,
        description, full_description,
        tx_type, direction_flag, is_fee, fee_for_reference,
        status, created_at
      FROM bank_tx_staging
      WHERE batch_id = ?
      ORDER BY tx_id ASC
      `,
      [batch_id]
    );

    return NextResponse.json({ ok: true, batch: batchRows[0], txs });
  }

  // lista
  const rows = await query(
    `
    SELECT
      batch_id, source, bank_account_no, statement_no,
      DATE_FORMAT(statement_date, '%Y-%m-%d') AS statement_date,
      opening_balance, closing_balance, total_debit, total_credit,
      imported_at
    FROM bank_import_batch
    ORDER BY batch_id DESC
    LIMIT 50
    `
  );

  return NextResponse.json({ ok: true, batches: rows });
}
