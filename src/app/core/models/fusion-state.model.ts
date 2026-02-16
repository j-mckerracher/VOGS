import type { FusionMode } from "./fusion-mode.model";
import type { RepresentationMode } from "./representation-mode.model";
import type { SceneLoadState } from "./load-state.model";

export interface FusionState {
  readonly fusionMode: FusionMode;
  readonly representationMode: RepresentationMode;
  readonly loadState: SceneLoadState;
}

export const INITIAL_FUSION_STATE: FusionState = {
  fusionMode: "single_agent",
  representationMode: "occupancy",
  loadState: {
    status: "idle",
    error: null
  }
} as const;
