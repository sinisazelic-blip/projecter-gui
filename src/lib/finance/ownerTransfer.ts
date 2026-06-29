/**
 * Prenos sa poslovnog na privatni račun vlasnika (SP) → blagajna IN.
 * Novac na privatnom računu = keš za isplate saradnicima itd.
 */

import { analyzeBankFee } from "@/lib/finance/bankFeeDetect";

export type OwnerTransferKind = "to_private_cash" | "owner_loan_in" | null;

export type OwnerTransferAnalysis = {
  kind: OwnerTransferKind;
  amountAbs: number;
  reason: string;
};

export function normalizeDigits(input: string): string {
  return String(input || "").replace(/\D+/g, "");
}

export function normalizeOwnerText(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const OUT_KEYWORDS = [
  "prenos",
  "isplata vlasniku",
  "isplata vlasnika",
  "placanje vlasniku",
  "placanje vlasnika",
  "transfer vlasniku",
];

/** Privatni → poslovni račun (posudba vlasnika firmi). */
const IN_KEYWORDS = [
  "posudba vlasnika",
  "posudba vlasniku",
  "uplata vlasnika",
  "uplata vlasniku",
  "povrat vlasnika",
  "pozajmica vlasnika",
];

export function buildOwnerHaystack(parts: Array<string | null | undefined>): string {
  return parts
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function analyzeOwnerTransfer(
  haystackRaw: string,
  amount: number,
  ownerPrivateAccountDigits = "",
): OwnerTransferAnalysis {
  const amountAbs = Math.round(Math.abs(Number(amount)) * 100) / 100;
  if (!(amountAbs > 0)) {
    return { kind: null, amountAbs: 0, reason: "zero" };
  }

  const haystackNorm = normalizeOwnerText(haystackRaw);
  const haystackDigits = normalizeDigits(haystackRaw);
  const hasOwnerAccount =
    ownerPrivateAccountDigits.length >= 10 &&
    haystackDigits.includes(ownerPrivateAccountDigits);

  const hasOutKeyword = OUT_KEYWORDS.some((k) => haystackNorm.includes(k));
  const hasInKeyword = IN_KEYWORDS.some((k) => haystackNorm.includes(k));
  const isBankFee = amount < 0 && analyzeBankFee(haystackRaw, amount) != null;

  // Odliv sa firme (negativan posting) → keš u blagajnu
  if (amount < 0 && !isBankFee) {
    if (hasOutKeyword) {
      return {
        kind: "to_private_cash",
        amountAbs,
        reason: hasOwnerAccount ? "account_and_keyword" : "keyword_out",
      };
    }
    if (hasOwnerAccount) {
      return {
        kind: "to_private_cash",
        amountAbs,
        reason: "owner_account_out",
      };
    }
  }

  // Priliv na firmu od vlasnika (posudba) — novac na poslovnom računu, ne blagajna
  if (amount > 0) {
    if (hasInKeyword || (hasOwnerAccount && !hasOutKeyword)) {
      return {
        kind: "owner_loan_in",
        amountAbs,
        reason: hasInKeyword ? "keyword_in" : "owner_account_in",
      };
    }
  }

  return { kind: null, amountAbs, reason: "no_match" };
}

export function isOwnerLoanText(haystackRaw: string): boolean {
  const t = normalizeOwnerText(haystackRaw);
  return IN_KEYWORDS.some((k) => t.includes(k));
}

export function isFxConversionText(haystackRaw: string): boolean {
  const text = normalizeOwnerText(haystackRaw);
  return text.includes("exch konverzija") || text.includes("konverzija operativni tecaj");
}

export function ownerCashMarker(postingId: number): string {
  return `owner_transfer_posting:${postingId}`;
}

export function ownerLoanMarker(postingId: number): string {
  return `owner_loan_posting:${postingId}`;
}

export function fxConversionMarker(postingId: number): string {
  return `fx_conversion_posting:${postingId}`;
}
