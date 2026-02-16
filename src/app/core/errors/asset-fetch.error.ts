export const ASSET_FETCH_ERROR_CODE = "ASSET_FETCH_ERROR" as const;

export class AssetFetchError extends Error {
  readonly code = ASSET_FETCH_ERROR_CODE;
  readonly status?: number;

  constructor(
    message: string,
    status?: number
  ) {
    super(message);
    this.name = "AssetFetchError";
    this.status = status;
  }
}
