import { Component } from "@angular/core";
import { METRIC_CONSTANTS } from "../../core/config/metrics.constants";

@Component({
  selector: "app-metrics-panel",
  standalone: true,
  templateUrl: "./metrics-panel.component.html",
  styleUrls: ["./metrics-panel.component.scss"]
})
export class MetricsPanelComponent {
  readonly dashboardMetrics = METRIC_CONSTANTS.dashboard;
}
