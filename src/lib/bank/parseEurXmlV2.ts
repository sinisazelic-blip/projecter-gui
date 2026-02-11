import { XMLParser } from "fast-xml-parser";

export type EurBatch = {
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

export type EurTx = {
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
  amountInBam?: number | null;
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

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function extractCounterpartyFromNapomena(nap?: string | null): string | null {
  if (!nap) return null;
  const s = String(nap).trim();
  const refMatch = s.match(/REF\s+[^\s]+\s+EUR\s+[\d.,]+\s*([A-Za-z0-9\s\-\.]+?)(?:\s+[A-Z]{2}\s|$|UPLATA|PLAĆANJE|BEOGRAD)/i);
  if (refMatch) return refMatch[1].trim() || null;
  return null;
}

function extractFeeForReference(desc?: string | null): string | null {
  if (!desc) return null;
  const m = String(desc).match(/naknada\s+za\s+konverziju/i);
  return m ? "EXCH" : null;
}

export function parseEurXmlV2(xmlText: string): { batch: EurBatch; txs: EurTx[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xmlText);
  const root = doc?.IZVOD_KOM_DEV_UPP;

  if (!root) throw new Error("EUR XML v2: root IZVOD_KOM_DEV_UPP nije pronađen.");

  const g1List = asArray<any>(root?.LIST_G_1?.G_1);
  const allTxs: EurTx[] = [];
  let batch: EurBatch | null = null;

  for (const g1 of g1List) {
    const g4List = asArray<any>(g1?.LIST_G_4?.G_4);

    for (const g4 of g4List) {
      const g6List = asArray<any>(g4?.LIST_G_6?.G_6);

      for (const g6 of g6List) {
        if (!batch) {
          batch = {
            uppId: g6.UPP_ID ?? null,
            accId: g6.CF_IBAN ?? g6.ACC_ID ?? null,
            taxId: g6.TAX_ID ?? null,
            companyName: g6.NAZIV_KOM ?? null,
            statementNo: g6.CF_BR_IZVODA ? Number(String(g6.CF_BR_IZVODA).trim()) : null,
            statementDate: parseBiHShortDate(g1.DATUM ?? g6.CF_DAT_PRET_IZVODA ?? null),
            openingBalance: g6.CF_SALDO_VALUTA_PRET_IZVODA != null ? toNumber(g6.CF_SALDO_VALUTA_PRET_IZVODA) : null,
            closingBalance: g6.CF_SALDO_DEV != null ? toNumber(g6.CF_SALDO_DEV) : null,
            totalDebit: g6.CS_UKUPNO_DEV_DUG != null ? toNumber(g6.CS_UKUPNO_DEV_DUG) : null,
            totalCredit: g6.CS_UKUPNO_DEV_POT != null ? toNumber(g6.CS_UKUPNO_DEV_POT) : null,
          };
        }

        const g5List = asArray<any>(g6?.LIST_G_5?.G_5);

        for (const g5 of g5List) {
          const devDug = toNumber(g5.DEV_DUG);
          const devPot = toNumber(g5.DEV_POT);
          const amount = devPot - devDug;

          const napomena = (g5.NAPOMENA ?? g5.CF_OPIS ?? null) as string | null;
          const isFee = String(napomena ?? "").toLowerCase().includes("naknada za konverziju") ||
            String(napomena ?? "").toLowerCase().includes("exch konverzija");

          allTxs.push({
            reference: (g5.CF_BROJ_NALOGA ?? g5.NALOG ?? null) as string | null,
            valueDate: parseBiHShortDate(g5.DATUM_VALUTE ?? null),
            amount,
            currency: "EUR",
            counterparty: extractCounterpartyFromNapomena(napomena),
            counterpartyBank: null,
            description: napomena,
            fullDescription: napomena,
            txType: g5.VRSTA_NALOGA != null ? Number(String(g5.VRSTA_NALOGA).trim()) : null,
            directionFlag: null,
            isFee,
            feeForReference: isFee ? extractFeeForReference(napomena) : null,
            amountInBam: toNumber(g5.CF_DIN_POT) - toNumber(g5.CF_DIN_DUG),
            raw: g5,
          });
        }
      }
    }
  }

  if (!batch) throw new Error("EUR XML v2: nisam pronašao G_6 (račun).");

  return { batch, txs: allTxs };
}
