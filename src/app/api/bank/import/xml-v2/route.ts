import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";
import { withTransaction } from "@/lib/db";
import { parseBamXmlV2 } from "@/lib/bank/parseBamXmlV2";
import { parseEurXmlV2 } from "@/lib/bank/parseEurXmlV2";

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
  currency?: string;
}): string {
  const key = [
    params.accId ?? "",
    String(params.statementNo ?? ""),
    params.reference ?? "",
    params.valueDate ?? "",
    (Math.round(params.amount * 100) / 100).toFixed(2),
    params.fullDescription ?? "",
    params.currency ?? "BAM",
  ].join("|");

  return sha256(key);
}

type TxForStaging = {
  reference?: string | null;
  valueDate?: string | null;
  amount: number;
  currency: string;
  counterparty?: string | null;
  counterpartyBank?: string | null;
  description?: string | null;
  fullDescription?: string | null;
  txType?: number | null;
  directionFlag?: number | null;
  isFee: boolean;
  feeForReference?: string | null;
  raw: any;
};

type BatchForStaging = {
  uppId?: string | null;
  accId?: string | null;
  taxId?: string | null;
  companyName?: string | null;
  statementNo?: number | null;
  statementDate?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  totalDebit?: number | null;
  totalCredit?: number | null;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST multipart/form-data: file=<xml>, account_id=<int>, mode=staging|final. Automatski detektuje BAM (IZVOD_KOM_KM_UPP) ili EUR (IZVOD_KOM_DEV_UPP).",
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const accountIdRaw = form.get("account_id");
    const mode = String(form.get("mode") ?? "staging");

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
    const xmlText = xmlBuf.toString("utf-8").replace(/^\uFEFF/, "");

    const file_hash = sha256(xmlBuf);

    const parser = new XMLParser({ ignoreAttributes: true });
    const doc = parser.parse(xmlText);
    const rootKeys = Object.keys(doc ?? {}).filter(
      (k) => !k.startsWith("?") && !k.startsWith("#"),
    );

    let batch: BatchForStaging;
    let txs: TxForStaging[];
    let source: string;
    let currency: string;

    if (rootKeys.includes("IZVOD_KOM_KM_UPP")) {
      const parsed = parseBamXmlV2(xmlText);
      batch = parsed.batch;
      txs = parsed.txs.map((t) => ({
        reference: t.reference,
        valueDate: t.valueDate,
        amount: t.amount,
        currency: "BAM",
        counterparty: t.counterparty,
        counterpartyBank: t.counterpartyBank,
        description: t.description,
        fullDescription: t.fullDescription,
        txType: t.txType,
        directionFlag: t.directionFlag,
        isFee: t.isFee,
        feeForReference: t.feeForReference,
        raw: t.raw,
      }));
      source = "BAM_XML_V2";
      currency = "BAM";
    } else if (rootKeys.includes("IZVOD_KOM_DEV_UPP")) {
      const parsed = parseEurXmlV2(xmlText);
      batch = parsed.batch;
      txs = parsed.txs.map((t) => ({
        reference: t.reference,
        valueDate: t.valueDate,
        amount: t.amount,
        currency: "EUR",
        counterparty: t.counterparty,
        counterpartyBank: t.counterpartyBank,
        description: t.description,
        fullDescription: t.fullDescription,
        txType: t.txType,
        directionFlag: t.directionFlag,
        isFee: t.isFee,
        feeForReference: t.feeForReference,
        raw: t.raw,
      }));
      source = "EUR_XML_V2";
      currency = "EUR";
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nepoznat format. Očekujem IZVOD_KOM_KM_UPP (BAM) ili IZVOD_KOM_DEV_UPP (EUR).",
        },
        { status: 400 },
      );
    }

    const result = await withTransaction(async (conn: any) => {
      const [batchRes]: any = await conn.execute(
        `
        INSERT INTO bank_import_batch
          (account_id, source, upp_id, bank_account_no, tax_id, company_name,
           statement_no, statement_date, currency,
           opening_balance, closing_balance, total_debit, total_credit, file_hash)
        VALUES
          (?, ?, ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          imported_at = CURRENT_TIMESTAMP
        `,
        [
          account_id,
          source,
          batch.uppId,
          batch.accId,
          batch.taxId,
          batch.companyName,
          batch.statementNo,
          batch.statementDate,
          currency,
          batch.openingBalance,
          batch.closingBalance,
          batch.totalDebit,
          batch.totalCredit,
          file_hash,
        ],
      );

      let batch_id: number | null = null;
      if (batchRes?.insertId) {
        batch_id = Number(batchRes.insertId);
      } else {
        const [rows]: any = await conn.execute(
          `SELECT batch_id FROM bank_import_batch WHERE file_hash = ? LIMIT 1`,
          [file_hash],
        );
        batch_id = rows?.[0]?.batch_id ? Number(rows[0].batch_id) : null;
      }
      if (!batch_id) throw new Error("Ne mogu odrediti batch_id.");

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
          currency: tx.currency,
        });

        const raw_json = JSON.stringify(tx.raw);

        const [r]: any = await conn.execute(
          `
          INSERT INTO bank_tx_staging
            (batch_id, tx_hash, reference, value_date, amount, currency,
             counterparty, counterparty_bank, description, full_description,
             tx_type, direction_flag, is_fee, fee_for_reference, status, raw_json)
          VALUES
            (?, ?, ?, ?, ?, ?,
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
            tx.currency,
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
      source,
      currency,
    });
  } catch (err: any) {
    const msg = err?.message ?? "Greška";
    return NextResponse.json(
      { ok: false, error: msg, stack: process.env.NODE_ENV === "development" ? err?.stack : undefined },
      { status: 500 },
    );
  }
}
