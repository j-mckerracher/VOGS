import { Component } from "@angular/core";
import type { OnDestroy } from "@angular/core";
import type { Subscription } from "rxjs";
import { ErrorOverlayComponent } from "./error-overlay.component";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { FusionStoreService } from "../../core/services/fusion-store.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { SceneAssetService } from "../../core/services/scene-asset.service";

@Component({
  selector: "app-viewport",
  standalone: true,
  imports: [ErrorOverlayComponent],
  template: `
    <section class="viewport" aria-label="3D scene viewport">
      <div class="viewport-surface" aria-hidden="true"></div>
      <app-error-overlay [open]="isErrorOverlayOpen" (retryRequested)="onRetryRequested()"></app-error-overlay>
    </section>
  `
})
export class ViewportComponent implements OnDestroy {
  private retrySubscription: Subscription | null = null;

  constructor(
    // eslint-disable-next-line no-unused-vars -- parameter property is used via this.sceneAssetService
    private readonly sceneAssetService: SceneAssetService,
    // eslint-disable-next-line no-unused-vars -- parameter property is used via this.fusionStore
    private readonly fusionStore: FusionStoreService
  ) {}

  get isErrorOverlayOpen(): boolean {
    return this.fusionStore.loadState().status === "failed";
  }

  onRetryRequested(): void {
    this.retrySubscription?.unsubscribe();
    this.retrySubscription = this.sceneAssetService.retryLast().subscribe((event) => {
      if (event.type === "loading") {
        this.fusionStore.setLoadState({
          status: "loading",
          error: null
        });
        return;
      }

      if (event.type === "failed") {
        this.fusionStore.setLoadState({
          status: "failed",
          error: {
            code: event.error.code,
            message: event.error.message
          }
        });
        return;
      }

      this.fusionStore.setLoadState({
        status: "ready",
        error: null
      });
    });
  }

  ngOnDestroy(): void {
    this.retrySubscription?.unsubscribe();
    this.retrySubscription = null;
  }
}
