import { afterEach, describe, expect, it, vi } from "vitest";
import { firstValueFrom, toArray } from "rxjs";
import type { SceneManifestEntry } from "../models/scene-manifest.model";
import { AssetBudgetError } from "../errors/asset-budget.error";
import { AssetFetchError } from "../errors/asset-fetch.error";
import { AssetParseError } from "../errors/asset-parse.error";
import {
  LOAD_EVENT_TYPES,
  SCENE_ASSET_TIMEOUT_MS,
  SceneAssetService,
  isLoadEventType
} from "./scene-asset.service";

const SCENE_ENTRY: SceneManifestEntry = {
  sceneId: "scene-001",
  displayName: "Scene 001",
  defaultFusionMode: "single_agent",
  defaultRepresentationMode: "occupancy",
  assets: [
    {
      id: "asset-001",
      url: "https://example.com/scene.ply",
      sizeBytes: 512_000
    }
  ]
};

describe("SceneAssetService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses a 12 second timeout for load requests", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>(() => {
          // keep pending to trigger timeout
        })
    );

    const service = new SceneAssetService();
    const eventsPromise = firstValueFrom(service.loadScene(SCENE_ENTRY).pipe(toArray()));

    await vi.advanceTimersByTimeAsync(SCENE_ASSET_TIMEOUT_MS * 2 + 50);
    const events = await eventsPromise;

    expect(events[0]?.type).toBe("loading");
    expect(events[1]?.type).toBe("failed");
    if (events[1]?.type === "failed") {
      expect(events[1].error).toBeInstanceOf(AssetFetchError);
      expect(events[1].error.message).toContain(`${SCENE_ASSET_TIMEOUT_MS}ms`);
    }
  });

  it("retries exactly once for transient network failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(
        new Response("ply-data", {
          status: 200
        })
      );

    const service = new SceneAssetService();
    const events = await firstValueFrom(service.loadScene(SCENE_ENTRY).pipe(toArray()));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events[0]?.type).toBe("loading");
    expect(events[1]?.type).toBe("ready");
  });

  it("emits only valid LoadEvent types", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ply-data", {
        status: 200
      })
    );

    const service = new SceneAssetService();
    const events = await firstValueFrom(service.loadScene(SCENE_ENTRY).pipe(toArray()));

    const emittedTypes = events.map((event) => event.type);
    expect(emittedTypes.every((type) => isLoadEventType(type))).toBe(true);
    expect(LOAD_EVENT_TYPES).toEqual(["loading", "ready", "failed"]);
  });

  it("maps failures into fetch/parse/budget taxonomy codes", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network down"));
    const service = new SceneAssetService();

    const fetchFailure = await firstValueFrom(
      service.loadScene(SCENE_ENTRY).pipe(toArray())
    );

    const parseFailureEntry: SceneManifestEntry = {
      ...SCENE_ENTRY,
      assets: [
        {
          ...SCENE_ENTRY.assets[0]!,
          url: "https://example.com/scene.unsupported"
        }
      ]
    };

    const parseFailure = await firstValueFrom(
      service.loadScene(parseFailureEntry).pipe(toArray())
    );

    const budgetFailureEntry: SceneManifestEntry = {
      ...SCENE_ENTRY,
      assets: [
        {
          ...SCENE_ENTRY.assets[0]!,
          sizeBytes: 2_500_000
        }
      ]
    };

    const budgetFailure = await firstValueFrom(
      service.loadScene(budgetFailureEntry).pipe(toArray())
    );

    expect(fetchFailure[1]?.type).toBe("failed");
    if (fetchFailure[1]?.type === "failed") {
      expect(fetchFailure[1].error).toBeInstanceOf(AssetFetchError);
      expect(fetchFailure[1].error.code).toBe("ASSET_FETCH_ERROR");
    }

    expect(parseFailure[1]?.type).toBe("failed");
    if (parseFailure[1]?.type === "failed") {
      expect(parseFailure[1].error).toBeInstanceOf(AssetParseError);
      expect(parseFailure[1].error.code).toBe("ASSET_PARSE_ERROR");
    }

    expect(budgetFailure[1]?.type).toBe("failed");
    if (budgetFailure[1]?.type === "failed") {
      expect(budgetFailure[1].error).toBeInstanceOf(AssetBudgetError);
      expect(budgetFailure[1].error.code).toBe("ASSET_BUDGET_ERROR");
    }
  });
});
