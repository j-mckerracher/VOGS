export const ASSET_BUDGET_ERROR_CODE = "ASSET_BUDGET_ERROR" as const;

export class AssetBudgetError extends Error {
  readonly code = ASSET_BUDGET_ERROR_CODE;
  readonly sizeBytes: number;

  constructor(
    message: string,
    sizeBytes: number
  ) {
    super(message);
    this.name = "AssetBudgetError";
    this.sizeBytes = sizeBytes;
  }
}
