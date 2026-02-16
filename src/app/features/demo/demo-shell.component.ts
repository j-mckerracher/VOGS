import { Component } from "@angular/core";
import type { OnDestroy } from "@angular/core";
import type { Subscription } from "rxjs";
import { AssetFetchError } from "../../core/errors/asset-fetch.error";
import { AssetParseError } from "../../core/errors/asset-parse.error";
import { AssetBudgetError } from "../../core/errors/asset-budget.error";
import type { LoadEvent, ReadyEvent } from "../../core/models/load-event.model";
import type { SceneManifestEntry } from "../../core/models/scene-manifest.model";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { DiagnosticsService } from "../../core/services/diagnostics.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { FusionStoreService } from "../../core/services/fusion-store.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { RendererAdapterService } from "../../core/services/renderer-adapter.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { SceneAssetService } from "../../core/services/scene-asset.service";

const RENDERER_LOAD_ERROR_CODE = "RENDERER_LOAD_ERROR" as const;
const UNKNOWN_LOAD_ERROR_CODE = "UNKNOWN_LOAD_ERROR" as const;

@Component({
  selector: "app-demo-shell",
  standalone: true,
  template: ""
})
export class DemoShellComponent implements OnDestroy {
  private loadSubscription: Subscription | null = null;
  private loadCycleId = 0;
  private terminalStateReached = false;
  private loadStartedAtMs = 0;
  private sceneId = "";
  private readonly sceneAssetService: SceneAssetService;
  private readonly diagnostics: DiagnosticsService;
  private readonly fusionStore: FusionStoreService;
  private readonly rendererAdapter: RendererAdapterService;

  constructor(
    sceneAssetService: SceneAssetService,
    diagnostics: DiagnosticsService,
    fusionStore: FusionStoreService,
    rendererAdapter: RendererAdapterService
  ) {
    this.sceneAssetService = sceneAssetService;
    this.diagnostics = diagnostics;
    this.fusionStore = fusionStore;
    this.rendererAdapter = rendererAdapter;
  }

  startLoad(entry: SceneManifestEntry): void {
    this.loadCycleId += 1;
    this.terminalStateReached = false;
    this.loadStartedAtMs = Date.now();
    this.sceneId = entry.sceneId;
    this.disposeLoadSubscription();
    this.diagnostics.logAssetLoadStart(entry.sceneId);
    this.loadSubscription = this.sceneAssetService.loadScene(entry).subscribe((event) => {
      void this.handleLoadEvent(event, this.loadCycleId);
    });
  }

  ngOnDestroy(): void {
    this.disposeLoadSubscription();
    this.rendererAdapter.dispose();
  }

  private async handleLoadEvent(event: LoadEvent, loadCycleId: number): Promise<void> {
    if (loadCycleId !== this.loadCycleId) {
      return;
    }

    if (event.type === "loading") {
      this.fusionStore.setLoadState({
        status: "loading",
        error: null
      });
      return;
    }

    if (this.terminalStateReached) {
      return;
    }

    if (event.type === "failed") {
      this.terminalStateReached = true;
      this.fusionStore.setLoadState({
        status: "failed",
        error: {
          code: event.error.code,
          message: event.error.message
        }
      });
      this.diagnostics.logAssetLoadFailed(this.sceneId, this.getLoadDurationMs(), event.error.code);
      return;
    }

    await this.applyReadyState(event, loadCycleId);
  }

  private async applyReadyState(event: ReadyEvent, loadCycleId: number): Promise<void> {
    try {
      await this.rendererAdapter.load(event.payload);
      if (this.loadCycleId !== loadCycleId || this.terminalStateReached) {
        return;
      }

      this.terminalStateReached = true;
      this.fusionStore.setLoadState({
        status: "ready",
        error: null
      });
      this.diagnostics.logAssetLoadSuccess(this.sceneId, this.getLoadDurationMs());
    } catch (error) {
      if (this.loadCycleId !== loadCycleId || this.terminalStateReached) {
        return;
      }

      const loadError = this.resolveLoadError(error);
      this.terminalStateReached = true;
      this.fusionStore.setLoadState({
        status: "failed",
        error: loadError
      });
      this.diagnostics.logAssetLoadFailed(this.sceneId, this.getLoadDurationMs(), loadError.code);
    }
  }

  private resolveLoadError(error: unknown): { code: string; message: string } {
    if (error instanceof AssetFetchError || error instanceof AssetParseError || error instanceof AssetBudgetError) {
      return {
        code: error.code,
        message: error.message
      };
    }

    if (error instanceof Error) {
      return {
        code: RENDERER_LOAD_ERROR_CODE,
        message: error.message
      };
    }

    return {
      code: UNKNOWN_LOAD_ERROR_CODE,
      message: "Scene loading failed with an unknown error."
    };
  }

  private disposeLoadSubscription(): void {
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = null;
  }

  private getLoadDurationMs(): number {
    return Math.max(0, Date.now() - this.loadStartedAtMs);
  }
}
