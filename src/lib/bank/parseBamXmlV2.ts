import { XMLParser } from "fast-xml-parser";

export type BamBatch = {
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

export type BamTx = {
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

function parseBiHShortDate(d?: string | null): string | null {
  if (!d) return null;
  const m = String(d).trim().match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const year = 2000 + parseInt(yy!, 10);
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
  const m = String(description).match(/provizija\s+za\s+nalog\s+([0-9\/-]+)/i);
  return m?.[1] ?? null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseBamXmlV2(xmlText: string): { batch: BamBatch; txs: BamTx[] } {
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
