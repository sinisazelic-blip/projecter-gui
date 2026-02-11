import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BamBatch = {
  uppId?: string | null;
  accId?: string | null;
  taxId?: string | null;
  companyName?: string | null;
  statementNo?: number | null;
  statementDate?: string | null; // YYYY-MM-DD
  openingBalance?: number | null;
  closingBalance?: number | null;
  totalDebit?: number | null;
  totalCredit?: number | null;
};

type BamTx = {
  reference?: string | null;
  valueDate?: string | null; // YYYY-MM-DD
  amount: number; // -duguje, +potrazuje
  currency: string; // BAM
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

function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function parseBiHShortDate(d?: string | null): string | null {
  // "13.01.26" -> "2026-01-13"
  if (!d) return null;
  const m = d.trim().match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const dd = m[1],
    mm = m[2],
    yy = m[3];
  const year = 2000 + parseInt(yy, 10);
  return `${year}-${mm}-${dd}`;
}

function toNumber(x: any): number {
  if (x === null || x === undefined) return 0;
  const s = String(x).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function extractFeeForReference(description?: string | null): string | null {
  if (!description) return null;
  const m = description.match(/provizija\s+za\s+nalog\s+([0-9\/-]+)/i);
  return m?.[1] ?? null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseBamXmlV2(xmlText: string): { batch: BamBatch; txs: BamTx[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xmlText);

  const root = doc?.IZVOD_KOM_KM_UPP;
  const g4 = root?.LIST_G_4?.G_4;
  const g2 = g4?.LIST_G_2?.G_2;
  const g3 = g2?.LIST_G_3?.G_3;

  if (!g3) throw new Error("BAM XML v2: ne mogu naći G_3 (izvod).");

  const batch: BamBatch = {
    uppId: g3.UPP_ID ?? null,
    accId: g3.ACC_ID ?? null,
    taxId: g3.TAX_ID ?? null,
    companyName: g3.NAZIV_KOM ?? null,
    statementNo: g3.CF_BR_IZVODA
      ? Number(String(g3.CF_BR_IZVODA).trim())
      : null,
    statementDate: parseBiHShortDate(
      root?.CF_DATUM_IZVODA ?? g4?.DATUM_KONTROLE ?? null,
    ),
    openingBalance:
      g3.CF_SALDO_PRIJE != null ? toNumber(g3.CF_SALDO_PRIJE) : null,
    closingBalance:
      g3.CS_SALDO_POSLIJE != null ? toNumber(g3.CS_SALDO_POSLIJE) : null,
    totalDebit: g3.CS_DUG != null ? toNumber(g3.CS_DUG) : null,
    totalCredit: g3.CS_POT != null ? toNumber(g3.CS_POT) : null,
  };

  const g1list = asArray<any>(g3?.LIST_G_1?.G_1);

  const txs: BamTx[] = g1list.map((g1) => {
    const debit = toNumber(g1.IZNOS_DUGUJE);
    const credit = toNumber(g1.IZNOS_POTRAZUJE);

    const amount = credit > 0 ? credit : -debit;
    const description = (g1.SVRHA ?? null) as string | null;
    const isFee = String(g1.TIP_NALOGA ?? "").trim() === "7";

    return {
      reference: (g1.BROJ ?? null) as string | null,
      valueDate: parseBiHShortDate(g1.DATUM_VALUTE ?? null),
      amount,
      currency: "BAM",
      counterparty: (g1.KOME ?? null) as string | null,
      counterpartyBank: (g1.NAZIV_BAN ?? null) as string | null,
      description,
      fullDescription: (g1.CF_SVRHA ?? null) as string | null,
      txType:
        g1.TIP_NALOGA != null ? Number(String(g1.TIP_NALOGA).trim()) : null,
      directionFlag: g1.FLAG != null ? Number(String(g1.FLAG).trim()) : null,
      isFee,
      feeForReference: isFee ? extractFeeForReference(description) : null,
      raw: g1,
    };
  });

  return { batch, txs };
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
      // 1) batch upsert
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
        ON DUPLICATE KEY UPDATE
          imported_at = CURRENT_TIMESTAMP
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
