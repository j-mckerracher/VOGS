import { Injectable, computed, signal } from "@angular/core";
import type { FusionMode } from "../models/fusion-mode.model";
import type { RepresentationMode } from "../models/representation-mode.model";
import type { SceneLoadState } from "../models/load-state.model";
import { INITIAL_FUSION_STATE } from "../models/fusion-state.model";

@Injectable({ providedIn: "root" })
export class FusionStoreService {
  private readonly stateSignal = signal(INITIAL_FUSION_STATE);

  readonly state = this.stateSignal.asReadonly();
  readonly fusionMode = computed(() => this.stateSignal().fusionMode);
  readonly representationMode = computed(() => this.stateSignal().representationMode);
  readonly loadState = computed(() => this.stateSignal().loadState);

  setFusionMode(fusionMode: FusionMode): void {
    this.stateSignal.update((state) => ({
      ...state,
      fusionMode
    }));
  }

  setRepresentationMode(representationMode: RepresentationMode): void {
    if (this.stateSignal().fusionMode === "ground_truth") {
      return;
    }

    this.stateSignal.update((state) => ({
      ...state,
      representationMode
    }));
  }

  setLoadState(loadState: SceneLoadState): void {
    this.stateSignal.update((state) => ({
      ...state,
      loadState
    }));
  }
}
