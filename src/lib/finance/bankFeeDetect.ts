import { normalizeOwnerText } from "@/lib/finance/ownerTransfer";

export type BankFeeKind =
  | "vodjenje_rn"
  | "gpp"
  | "provizija_nalog"
  | "bank_generic"
  | null;

export type BankFeeAnalysis = {
  kind: BankFeeKind;
  label: string;
};

export function analyzeBankFee(
  haystackRaw: string,
  amount: number,
): BankFeeAnalysis | null {
  if (!(Number(amount) < 0)) return null;

  const t = normalizeOwnerText(haystackRaw);

  if (
    t.includes("vodjenje rn") ||
    t.includes("vodjenje racuna") ||
    t.includes("naknade za vodjenje") ||
    t.includes("naknada za vodjenje")
  ) {
    return { kind: "vodjenje_rn", label: "Naknada za vođenje računa" };
  }

  if (t.includes("gpp naknade") || t.includes("gpp naknada")) {
    return { kind: "gpp", label: "GPP naknada" };
  }

  if (
    t.includes("naplacena provizija") ||
    (t.includes("provizija") && t.includes("nalog"))
  ) {
    return { kind: "provizija_nalog", label: "Provizija za nalog" };
  }

  if (
    t.includes("provizija") ||
    t.includes("bankarsk") ||
    (t.includes("naknada") && !t.includes("prenos"))
  ) {
    return { kind: "bank_generic", label: "Bankovna naknada" };
  }

  return null;
}

export function isBankProvizijaText(haystackRaw: string, amount?: number): boolean {
  if (amount != null && !(Number(amount) < 0)) return false;
  return analyzeBankFee(haystackRaw, amount ?? -1) != null;
}
