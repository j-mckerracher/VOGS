import { describe, expect, it, vi } from "vitest";
import { of } from "rxjs";
import { AssetFetchError } from "../../core/errors/asset-fetch.error";
import type { LoadEvent } from "../../core/models/load-event.model";
import type { ParsedScenePayload } from "../../core/models/parsed-scene-payload.model";
import type { SceneManifestEntry } from "../../core/models/scene-manifest.model";
import type { DiagnosticsService } from "../../core/services/diagnostics.service";
import { FusionStoreService } from "../../core/services/fusion-store.service";
import type { RendererAdapterService } from "../../core/services/renderer-adapter.service";
import type { SceneAssetService } from "../../core/services/scene-asset.service";
import { DemoShellComponent } from "./demo-shell.component";

const SCENE_ENTRY: SceneManifestEntry = {
  sceneId: "scene-001",
  displayName: "Scene 001",
  defaultFusionMode: "single_agent",
  defaultRepresentationMode: "occupancy",
  assets: [
    {
      id: "asset-001",
      url: "https://example.com/scene.splat",
      sizeBytes: 100_000
    }
  ]
};

const READY_PAYLOAD: ParsedScenePayload = {
  sceneId: "scene-001",
  assetUrl: "https://example.com/scene.splat",
  format: "splat",
  sizeBytes: 100_000,
  data: new ArrayBuffer(16)
};

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createComponent = (events: readonly LoadEvent[], rendererShouldFail = false) => {
  const sceneAssetService = {
    loadScene: vi.fn(() => of(...events))
  } as unknown as SceneAssetService;

  const rendererLoad = rendererShouldFail
    ? vi.fn().mockRejectedValue(new Error("renderer failed to load payload"))
    : vi.fn().mockResolvedValue(undefined);

  const rendererAdapter = {
    load: rendererLoad,
    dispose: vi.fn()
  } as unknown as RendererAdapterService;
  const diagnostics = {
    logAssetLoadStart: vi.fn(),
    logAssetLoadSuccess: vi.fn(),
    logAssetLoadFailed: vi.fn()
  } as unknown as DiagnosticsService;

  const store = new FusionStoreService();
  const setLoadStateSpy = vi.spyOn(store, "setLoadState");
  const component = new DemoShellComponent(sceneAssetService, diagnostics, store, rendererAdapter);

  return {
    component,
    diagnostics,
    sceneAssetService,
    rendererAdapter,
    store,
    setLoadStateSpy
  };
};

describe("DemoShellComponent integration", () => {
  it("transitions loading to ready and initializes renderer", async () => {
    const { component, diagnostics, sceneAssetService, rendererAdapter, store, setLoadStateSpy } = createComponent([
      { type: "loading" },
      { type: "ready", payload: READY_PAYLOAD }
    ]);

    component.startLoad(SCENE_ENTRY);
    await flushPromises();

    expect(sceneAssetService.loadScene).toHaveBeenCalledWith(SCENE_ENTRY);
    expect(diagnostics.logAssetLoadStart).toHaveBeenCalledWith("scene-001");
    expect(diagnostics.logAssetLoadSuccess).toHaveBeenCalledOnce();
    expect(rendererAdapter.load).toHaveBeenCalledOnce();
    expect(rendererAdapter.load).toHaveBeenCalledWith(READY_PAYLOAD);
    expect(setLoadStateSpy.mock.calls.map(([state]) => state.status)).toEqual(["loading", "ready"]);
    expect(store.loadState()).toEqual({
      status: "ready",
      error: null
    });
  });

  it("transitions loading to failed and does not initialize renderer", async () => {
    const { component, diagnostics, rendererAdapter, store, setLoadStateSpy } = createComponent([
      { type: "loading" },
      {
        type: "failed",
        error: new AssetFetchError("asset fetch failed", 500)
      }
    ]);

    expect(() => component.startLoad(SCENE_ENTRY)).not.toThrow();
    await flushPromises();

    expect(rendererAdapter.load).not.toHaveBeenCalled();
    expect(diagnostics.logAssetLoadFailed).toHaveBeenCalledWith("scene-001", expect.any(Number), "ASSET_FETCH_ERROR");
    expect(setLoadStateSpy.mock.calls.map(([state]) => state.status)).toEqual(["loading", "failed"]);
    expect(store.loadState()).toEqual({
      status: "failed",
      error: {
        code: "ASSET_FETCH_ERROR",
        message: "asset fetch failed"
      }
    });
  });

  it("fails safely when renderer load throws after ready event", async () => {
    const { component, diagnostics, rendererAdapter, store, setLoadStateSpy } = createComponent(
      [
        { type: "loading" },
        { type: "ready", payload: READY_PAYLOAD }
      ],
      true
    );

    expect(() => component.startLoad(SCENE_ENTRY)).not.toThrow();
    await flushPromises();

    expect(rendererAdapter.load).toHaveBeenCalledOnce();
    expect(diagnostics.logAssetLoadFailed).toHaveBeenCalledWith("scene-001", expect.any(Number), "RENDERER_LOAD_ERROR");
    expect(setLoadStateSpy.mock.calls.map(([state]) => state.status)).toEqual(["loading", "failed"]);
    expect(store.loadState()).toEqual({
      status: "failed",
      error: {
        code: "RENDERER_LOAD_ERROR",
        message: "renderer failed to load payload"
      }
    });
  });
});
