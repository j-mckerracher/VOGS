import type { FusionMode } from "./fusion-mode.model";
import type { RepresentationMode } from "./representation-mode.model";

export interface SceneManifestAsset {
  readonly id: string;
  readonly url: string;
  readonly sizeBytes: number;
}

export interface SceneManifestEntry {
  readonly sceneId: string;
  readonly displayName: string;
  readonly defaultFusionMode: FusionMode;
  readonly defaultRepresentationMode: RepresentationMode;
  readonly assets: readonly SceneManifestAsset[];
}

export interface SceneManifest {
  readonly version: string;
  readonly generatedAt: string;
  readonly scenes: readonly SceneManifestEntry[];
}
