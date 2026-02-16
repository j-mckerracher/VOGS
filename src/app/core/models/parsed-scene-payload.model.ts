export type ParsedSceneAssetFormat = "ply" | "splat" | "gltf";

export interface ParsedScenePayload {
  readonly sceneId: string;
  readonly assetUrl: string;
  readonly format: ParsedSceneAssetFormat;
  readonly sizeBytes: number;
  readonly data: ArrayBuffer | string | unknown;
}
