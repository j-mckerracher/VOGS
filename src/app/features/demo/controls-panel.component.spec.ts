import { COMPILER_OPTIONS } from "@angular/core";
import { TestBed, TestComponentRenderer } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "zone.js";
import type { DiagnosticsService } from "../../core/services/diagnostics.service";
import type { FusionMode } from "../../core/models/fusion-mode.model";
import type { RepresentationMode } from "../../core/models/representation-mode.model";
import { FusionStoreService } from "../../core/services/fusion-store.service";
import { ControlsPanelComponent } from "./controls-panel.component";

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

describe("ControlsPanelComponent", () => {
  let component: ControlsPanelComponent;
  let currentFusionMode: FusionMode;
  let currentRepresentationMode: RepresentationMode;
  let setFusionMode: ReturnType<typeof vi.fn>;
  let setRepresentationMode: ReturnType<typeof vi.fn>;
  let diagnosticsService: DiagnosticsService;
  let logFusionModeChanged: ReturnType<typeof vi.fn>;
  let logRepresentationChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ensureAngularTestEnvironment();

    currentFusionMode = "single_agent";
    currentRepresentationMode = "occupancy";
    setFusionMode = vi.fn((mode: FusionMode) => {
      currentFusionMode = mode;
    });
    setRepresentationMode = vi.fn((mode: RepresentationMode) => {
      currentRepresentationMode = mode;
    });
    logFusionModeChanged = vi.fn();
    logRepresentationChanged = vi.fn();

    const fusionStoreMock = {
      fusionMode: () => currentFusionMode,
      representationMode: () => currentRepresentationMode,
      setFusionMode,
      setRepresentationMode
    };
    diagnosticsService = {
      logFusionModeChanged,
      logRepresentationChanged
    } as unknown as DiagnosticsService;

    TestBed.configureTestingModule({
      providers: [{ provide: FusionStoreService, useValue: fusionStoreMock }]
    });

    component = new ControlsPanelComponent(TestBed.inject(FusionStoreService), diagnosticsService);
  });

  it("supports selecting all four fusion modes via component handlers", () => {
    const modes: FusionMode[] = ["single_agent", "naive_fusion", "vogs", "ground_truth"];

    modes.forEach((mode) => {
      component.onFusionModeChange(mode);
    });

    expect(setFusionMode).toHaveBeenCalledTimes(4);
    expect(setFusionMode.mock.calls.map(([mode]) => mode)).toEqual(modes);
  });

  it("exposes ground truth state for disabled representation bindings", () => {
    expect(component.isGroundTruthMode).toBe(false);

    currentFusionMode = "ground_truth";

    expect(component.isGroundTruthMode).toBe(true);
  });

  it("delegates fusion mode updates through the fusion store", () => {
    component.onFusionModeChange("vogs");

    expect(setFusionMode).toHaveBeenCalledWith("vogs");
    expect(logFusionModeChanged).toHaveBeenCalledWith("controls-panel", "vogs");
  });

  it("delegates representation mode updates through the fusion store", () => {
    component.onRepresentationModeChange("gaussian");

    expect(setRepresentationMode).toHaveBeenCalledWith("gaussian");
    expect(logRepresentationChanged).toHaveBeenCalledWith("controls-panel", "gaussian");
  });
});
