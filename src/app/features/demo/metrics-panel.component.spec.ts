import { COMPILER_OPTIONS } from "@angular/core";
import { TestBed, TestComponentRenderer } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { beforeEach, describe, expect, it } from "vitest";
import "zone.js";
import { METRIC_CONSTANTS } from "../../core/config/metrics.constants";
import { MetricsPanelComponent } from "./metrics-panel.component";
import { TrackVisibilityService } from "../../core/services/track-visibility.service";
import { FusionStoreService } from "../../core/services/fusion-store.service";

let angularTestEnvironmentInitialized = false;

class NoopTestComponentRenderer extends TestComponentRenderer {
  override insertRootElement(): void {}
}

const ensureAngularTestEnvironment = () => {
  if (angularTestEnvironmentInitialized) {
    return;
  }

  TestBed.initTestEnvironment(
    BrowserTestingModule,
    platformBrowserTesting([
      { provide: COMPILER_OPTIONS, useValue: {}, multi: true },
      { provide: TestComponentRenderer, useClass: NoopTestComponentRenderer }
    ])
  );
  angularTestEnvironmentInitialized = true;
};

describe("MetricsPanelComponent", () => {
  let component: MetricsPanelComponent;

  beforeEach(() => {
    ensureAngularTestEnvironment();
    TestBed.configureTestingModule({});
    const tv = TestBed.inject(TrackVisibilityService);
    const fs = TestBed.inject(FusionStoreService);
    component = new MetricsPanelComponent(tv, fs);
  });

  it("uses canonical dashboard metrics while hero metric remains separate", () => {
    expect(component.dashboardMetrics).toBe(METRIC_CONSTANTS.dashboard);
    expect(component.dashboardMetrics.improvementMiou).toBe(METRIC_CONSTANTS.dashboard.improvementMiou);
    expect(component.dashboardMetrics.bandwidthReductionPercent).toBe(
      METRIC_CONSTANTS.dashboard.bandwidthReductionPercent
    );
    expect(component.dashboardMetrics.improvementMiou).not.toBe(METRIC_CONSTANTS.hero.improvementMiou);
  });
});
