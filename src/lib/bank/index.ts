export type BankStageResult = {
  batch_id: number;
  scanned: number;
  inserted: number;
  skipped: number;
  errors: Record<string, any>;
  mapping: Record<string, any>;
};

export type BankCommitResult = {
  batch_id: number;
  scanned: number;
  inserted: number;
  skipped: number;
  errors: Record<string, any>;
  mapping: Record<string, any>;
};

export async function stageBankCosts(_payload: any): Promise<BankStageResult> {
  throw new Error("NOT_IMPLEMENTED: stageBankCosts");
}

export async function commitBankCosts(
  _payload: any,
): Promise<BankCommitResult> {
  throw new Error("NOT_IMPLEMENTED: commitBankCosts");
}
