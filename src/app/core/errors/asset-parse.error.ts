export const ASSET_PARSE_ERROR_CODE = "ASSET_PARSE_ERROR" as const;

export class AssetParseError extends Error {
  readonly code = ASSET_PARSE_ERROR_CODE;

  constructor(message: string) {
    super(message);
    this.name = "AssetParseError";
  }
}
