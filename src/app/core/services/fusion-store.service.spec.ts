import { describe, expect, it } from "vitest";
import { FusionStoreService } from "./fusion-store.service";
import type { SceneLoadState } from "../models/load-state.model";

describe("FusionStoreService", () => {
  it("updates fusion mode via setFusionMode", () => {
    const store = new FusionStoreService();

    store.setFusionMode("vogs");

    expect(store.fusionMode()).toBe("vogs");
    expect(store.state().fusionMode).toBe("vogs");
  });

  it("updates representation mode when fusion mode is writable", () => {
    const store = new FusionStoreService();
    store.setFusionMode("single_agent");

    store.setRepresentationMode("gaussian");

    expect(store.representationMode()).toBe("gaussian");
    expect(store.state().representationMode).toBe("gaussian");
  });

  it("ignores representation updates when fusion mode is ground_truth", () => {
    const store = new FusionStoreService();
    store.setRepresentationMode("gaussian");
    store.setFusionMode("ground_truth");

    store.setRepresentationMode("occupancy");

    expect(store.representationMode()).toBe("gaussian");
    expect(store.state().representationMode).toBe("gaussian");
  });

  it("updates load state via setLoadState", () => {
    const store = new FusionStoreService();
    const nextLoadState: SceneLoadState = {
      status: "loading",
      error: null
    };

    store.setLoadState(nextLoadState);

    expect(store.loadState()).toEqual(nextLoadState);
    expect(store.state().loadState).toEqual(nextLoadState);
  });
});
