import { Component } from "@angular/core";
import type { FusionMode } from "../../core/models/fusion-mode.model";
import type { RepresentationMode } from "../../core/models/representation-mode.model";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { DiagnosticsService } from "../../core/services/diagnostics.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { FusionStoreService } from "../../core/services/fusion-store.service";

const CONTROLS_PANEL_SCENE_ID = "controls-panel";

@Component({
  selector: "app-controls-panel",
  standalone: true,
  templateUrl: "./controls-panel.component.html",
  styleUrls: ["./controls-panel.component.scss"]
})
export class ControlsPanelComponent {
  private readonly fusionStore: FusionStoreService;
  private readonly diagnostics: DiagnosticsService;
  constructor(
    fusionStore: FusionStoreService,
    diagnostics: DiagnosticsService
  ) {
    this.fusionStore = fusionStore;
    this.diagnostics = diagnostics;
  }

  fusionMode(): FusionMode {
    return this.fusionStore.fusionMode();
  }

  representationMode(): RepresentationMode {
    return this.fusionStore.representationMode();
  }

  onFusionModeChange(mode: FusionMode): void {
    this.fusionStore.setFusionMode(mode);
    this.diagnostics.logFusionModeChanged(CONTROLS_PANEL_SCENE_ID, mode);
  }

  onRepresentationModeChange(mode: RepresentationMode): void {
    this.fusionStore.setRepresentationMode(mode);
    this.diagnostics.logRepresentationChanged(CONTROLS_PANEL_SCENE_ID, mode);
  }

  get isGroundTruthMode(): boolean {
    return this.fusionMode() === "ground_truth";
  }
}
