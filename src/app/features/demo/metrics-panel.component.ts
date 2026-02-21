import { Component } from "@angular/core";
import { METRIC_CONSTANTS } from "../../core/config/metrics.constants";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { TrackVisibilityService } from "../../core/services/track-visibility.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Angular DI needs runtime token
import { FusionStoreService } from "../../core/services/fusion-store.service";

@Component({
  selector: "app-metrics-panel",
  standalone: true,
  templateUrl: "./metrics-panel.component.html",
  styleUrls: ["./metrics-panel.component.scss"]
})
export class MetricsPanelComponent {
  readonly dashboardMetrics = METRIC_CONSTANTS.dashboard;

  constructor(
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    readonly trackVisibility: TrackVisibilityService,
    // eslint-disable-next-line no-unused-vars -- Angular DI constructor parameter property
    readonly fusionStore: FusionStoreService
  ) {}
}
