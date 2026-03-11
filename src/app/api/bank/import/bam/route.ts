import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { withTransaction } from "@/lib/db";
import { parseBamXmlV2 } from "@/lib/bank/parseBamXmlV2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function buildTxHash(params: {
  accId?: string | null;
  statementNo?: number | null;
  reference?: string | null;
  valueDate?: string | null;
  amount: number;
  fullDescription?: string | null;
}): string {
  const key = [
    params.accId ?? "",
    String(params.statementNo ?? ""),
    params.reference ?? "",
    params.valueDate ?? "",
    (Math.round(params.amount * 100) / 100).toFixed(2),
    params.fullDescription ?? "",
  ].join("|");

  return sha256(key);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST multipart/form-data: file=<xml>, account_id=<int>, mode=staging|final",
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const accountIdRaw = form.get("account_id");
    const mode = String(form.get("mode") ?? "staging"); // staging | final (final opcionalno)

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nedostaje file." },
        { status: 400 },
      );
    }

    const account_id =
      accountIdRaw != null && String(accountIdRaw).trim() !== ""
        ? Number(String(accountIdRaw))
        : null;

    const xmlBuf = Buffer.from(await file.arrayBuffer());
    const xmlText = xmlBuf.toString("utf-8");
    const file_hash = sha256(xmlBuf);

    const { batch, txs } = parseBamXmlV2(xmlText);

    const result = await withTransaction(async (conn) => {
      // 1) Isti fajl = isti file_hash → koristi postojeći batch (bez UNIQUE u bazi također radi)
      const [existing]: any = await conn.execute(
        `SELECT batch_id FROM bank_import_batch WHERE file_hash = ? LIMIT 1`,
        [file_hash],
      );
      let batch_id: number | null =
        existing?.[0]?.batch_id != null ? Number(existing[0].batch_id) : null;

      if (batch_id == null) {
        const [batchRes]: any = await conn.execute(
          `
          INSERT INTO bank_import_batch
            (account_id, source, upp_id, bank_account_no, tax_id, company_name,
             statement_no, statement_date, currency,
             opening_balance, closing_balance, total_debit, total_credit, file_hash)
          VALUES
            (?, 'BAM_XML_V2', ?, ?, ?, ?,
             ?, ?, 'BAM',
             ?, ?, ?, ?, ?)
          `,
          [
            account_id,
            batch.uppId,
            batch.accId,
            batch.taxId,
            batch.companyName,
            batch.statementNo,
            batch.statementDate,
            batch.openingBalance,
            batch.closingBalance,
            batch.totalDebit,
            batch.totalCredit,
            file_hash,
          ],
        );
        batch_id = batchRes?.insertId ? Number(batchRes.insertId) : null;
      } else {
        await conn.execute(
          `UPDATE bank_import_batch SET imported_at = CURRENT_TIMESTAMP WHERE batch_id = ?`,
          [batch_id],
        );
      }
      if (!batch_id) throw new Error("Ne mogu odrediti batch_id.");

      // 2) staging insert (duplikate ne diramo – no-op)
      let inserted = 0;
      let duplicates = 0;

      for (const tx of txs) {
        const tx_hash = buildTxHash({
          accId: batch.accId ?? null,
          statementNo: batch.statementNo ?? null,
          reference: tx.reference ?? null,
          valueDate: tx.valueDate ?? null,
          amount: tx.amount,
          fullDescription: tx.fullDescription ?? null,
        });

        const raw_json = JSON.stringify(tx.raw);

        const [r]: any = await conn.execute(
          `
          INSERT INTO bank_tx_staging
            (batch_id, tx_hash, reference, value_date, amount, currency,
             counterparty, counterparty_bank, description, full_description,
             tx_type, direction_flag, is_fee, fee_for_reference, status, raw_json)
          VALUES
            (?, ?, ?, ?, ?, 'BAM',
             ?, ?, ?, ?,
             ?, ?, ?, ?, 'NEW', CAST(? AS JSON))
          ON DUPLICATE KEY UPDATE
            last_seen_at = CURRENT_TIMESTAMP
          `,
          [
            batch_id,
            tx_hash,
            tx.reference,
            tx.valueDate,
            tx.amount,
            tx.counterparty,
            tx.counterpartyBank,
            tx.description,
            tx.fullDescription,
            tx.txType,
            tx.directionFlag,
            tx.isFee ? 1 : 0,
            tx.feeForReference,
            raw_json,
          ],
        );

        if (r?.insertId) inserted++;
        else duplicates++;
      }

      // 3) final (opciono – možeš ignorisati)
      if (mode === "final") {
        await conn.execute(
          `
          INSERT IGNORE INTO bank_transactions
            (batch_id, tx_hash, reference, value_date, amount, currency,
             counterparty, counterparty_bank, description, full_description,
             tx_type, direction_flag, is_fee, fee_for_reference, raw_json)
          SELECT
            batch_id, tx_hash, reference, value_date, amount, currency,
            counterparty, counterparty_bank, description, full_description,
            tx_type, direction_flag, is_fee, fee_for_reference, raw_json
          FROM bank_tx_staging
          WHERE batch_id = ?
          `,
          [batch_id],
        );
      }

      return { batch_id, inserted, duplicates, parsed: txs.length };
    });

    return NextResponse.json({
      ok: true,
      ...result,
      file_hash,
      batch,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
