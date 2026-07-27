import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Nova Banka PDF izvod → isti oblik kao BAM XML V2 staging.
 * Tekstualni PDF (ne sken). Transakcije između "RBR." i "Nalog Racun"/"NOVO STANJE".
 */

export type NovaBatch = {
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

export type NovaTx = {
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
  raw: Record<string, unknown>;
};

function parseMoney(raw: string): number {
  const s = String(raw || "")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function parseBiHDate(d?: string | null): string | null {
  if (!d) return null;
  const m = String(d)
    .trim()
    .match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isFeeText(description: string, counterparty: string): boolean {
  const d = description.toLowerCase();
  const c = counterparty.toLowerCase();
  if (c.includes("nova banka") && (d.includes("naknad") || d.includes("provizij") || d.includes("naplata upp"))) {
    return true;
  }
  return d.includes("naplata upp") || (d.includes("naknad") && c.includes("nova"));
}

/**
 * Parsira već izvučen tekst PDF-a.
 */
export function parseNovaPdfText(textRaw: string): { batch: NovaBatch; txs: NovaTx[] } {
  const text = String(textRaw || "").replace(/\r/g, "");
  if (!/IZVOD\s+BR\./i.test(text) || !/NOVA\s+BANKA/i.test(text)) {
    throw new Error(
      "Ovo ne izgleda kao Nova Banka PDF izvod (očekujem 'IZVOD BR.' i 'Nova banka').",
    );
  }

  const statementNoM = text.match(/IZVOD\s+BR\.\s*(\d+)/i);
  const statementNo = statementNoM ? Number(statementNoM[1]) : null;

  const dateM = text.match(/(\d{2}\.\d{2}\.\d{4})/);
  const statementDate = parseBiHDate(dateM?.[1] ?? null);

  const accM = text.match(/\b(\d{3}-\d{11}-\d{2})\b/);
  const accId = accM?.[1] ?? null;

  const mbrM = text.match(/MBR\s+(\d+)/i);
  const taxId = mbrM?.[1] ?? null;

  const companyM = text.match(
    /IZVOD\s+BR\.\s*\d+\s*\nO PROMJENAMA[^\n]*\n\d{2}\.\d{2}\.\d{4}\s*\n([^\n]+)/i,
  );
  const companyName = companyM?.[1]?.trim() || null;

  const openM = text.match(/PRETHODNO\s+STANJE\s+([\d.,]+)/i);
  const openingBalance = openM ? parseMoney(openM[1]) : null;

  const prometM = text.match(/([\d.,]+)\s+([\d.,]+)\s+UKUPAN\s+PROMET/i);
  const totalDebit = prometM ? parseMoney(prometM[1]) : null;
  const totalCredit = prometM ? parseMoney(prometM[2]) : null;

  let closingBalance: number | null = null;
  const afterPromet = text.split(/UKUPAN\s+PROMET/i)[1] || "";
  const moneyAfter = afterPromet.match(/(-?[\d.,]+)/);
  if (moneyAfter) closingBalance = parseMoney(moneyAfter[1]);
  if (
    closingBalance == null &&
    openingBalance != null &&
    totalDebit != null &&
    totalCredit != null
  ) {
    closingBalance =
      Math.round((openingBalance + totalCredit - totalDebit) * 100) / 100;
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const startIdx = lines.findIndex((l) => /^RBR\.?$/i.test(l));
  if (startIdx < 0) {
    throw new Error("Nova PDF: ne nalazim početak liste (RBR.).");
  }

  const txs: NovaTx[] = [];
  let i = startIdx + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (
      /^Nalog\s+Racun/i.test(line) ||
      /^NOVO\s+STANJE/i.test(line) ||
      /^NEIZVR/i.test(line) ||
      /^Poštovani/i.test(line)
    ) {
      break;
    }

    const refM = line.match(/^(\d+)\s*\/\s*(.+)$/);
    if (!refM) {
      i += 1;
      continue;
    }

    const reference = refM[1];
    const description = refM[2].trim();
    const detail = lines[i + 1] || "";
    const detailM = detail.match(
      /^(\d{10,20})\s+(.+?)\s+(-?[\d.,]+)\s+(-?[\d.,]+)$/,
    );
    if (!detailM) {
      i += 1;
      continue;
    }

    const partnerAccount = detailM[1];
    const counterparty = detailM[2].trim();
    const debit = parseMoney(detailM[3]);
    const credit = parseMoney(detailM[4]);
    const amount = credit > 0 ? credit : -debit;
    const isFee = isFeeText(description, counterparty);

    txs.push({
      reference,
      valueDate: statementDate,
      amount,
      currency: "BAM",
      counterparty,
      counterpartyBank: partnerAccount,
      description,
      fullDescription: `${reference} / ${description} | ${partnerAccount} ${counterparty}`,
      txType: isFee ? 7 : null,
      directionFlag: amount >= 0 ? 1 : 2,
      isFee,
      feeForReference: null,
      raw: {
        reference,
        description,
        partnerAccount,
        counterparty,
        debit,
        credit,
        rbr: lines[i + 2] && /^\d+$/.test(lines[i + 2]) ? Number(lines[i + 2]) : null,
      },
    });

    i += 2;
    if (lines[i] && /^\d+$/.test(lines[i])) i += 1;
  }

  if (txs.length === 0) {
    throw new Error("Nova PDF: nema transakcija u izvodu.");
  }

  const batch: NovaBatch = {
    uppId: null,
    accId,
    taxId,
    companyName,
    statementNo: Number.isFinite(statementNo as number) ? statementNo : null,
    statementDate,
    openingBalance,
    closingBalance,
    totalDebit,
    totalCredit,
  };

  return { batch, txs };
}

export async function extractPdfText(pdfBuf: Buffer): Promise<string> {
  // pdf-parse/pdfjs Next webpack kvari — ekstrakcija u zasebnom Node procesu.
  const script = path.join(process.cwd(), "src/lib/bank/extractPdfText.cjs");
  const tmp = path.join(
    os.tmpdir(),
    `fluxa-nova-pdf-${process.pid}-${Date.now()}.pdf`,
  );
  await writeFile(tmp, pdfBuf);
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [script, tmp],
      {
        maxBuffer: 12 * 1024 * 1024,
        windowsHide: true,
        env: process.env,
      },
    );
    const text = String(stdout || "").trim();
    if (!text) {
      const errTail = String(stderr || "").trim();
      throw new Error(
        errTail
          ? `PDF ekstrakcija prazna: ${errTail}`
          : "PDF nema izvučen tekst (možda je sken).",
      );
    }
    return text;
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

export async function parseNovaPdf(
  pdfBuf: Buffer,
): Promise<{ batch: NovaBatch; txs: NovaTx[] }> {
  const text = await extractPdfText(pdfBuf);
  return parseNovaPdfText(text);
}
