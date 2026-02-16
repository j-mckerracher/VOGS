import { describe, expect, it, vi } from "vitest";
import { DiagnosticsService } from "./diagnostics.service";

const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T/;
// eslint-disable-next-line no-unused-vars
type WriteSpyTarget = { write: (...args: [Record<string, unknown>]) => void };

describe("DiagnosticsService", () => {
  it("emits payload keys that match diagnostics schema", () => {
    const service = new DiagnosticsService();
    const writeSpy = vi.spyOn(service as unknown as WriteSpyTarget, "write");

    service.logAssetLoadStart("scene-001");
    service.logAssetLoadSuccess("scene-001", 123);
    service.logAssetLoadFailed("scene-001", 321, "ASSET_FETCH_ERROR");
    service.logFusionModeChanged("scene-001", "vogs");
    service.logRepresentationChanged("scene-001", "gaussian");

    const emittedPayloads = writeSpy.mock.calls.map(([payload]) => payload);
    const allowedKeys = ["event", "timestamp", "sceneId", "mode", "durationMs", "errorCode"];

    emittedPayloads.forEach((payload) => {
      const keys = Object.keys(payload);
      expect(keys.every((key) => allowedKeys.includes(key))).toBe(true);
      expect(payload).toHaveProperty("event");
      expect(payload).toHaveProperty("timestamp");
      expect(payload).toHaveProperty("sceneId");
      expect(payload.sceneId).toBe("scene-001");
      expect(typeof payload.timestamp).toBe("string");
      expect(payload.timestamp).toMatch(ISO_TIMESTAMP_REGEX);
    });
  });

  it("does not include user identifier fields in emitted payloads", () => {
    const service = new DiagnosticsService();
    const writeSpy = vi.spyOn(service as unknown as WriteSpyTarget, "write");

    service.logAssetLoadFailed("scene-001", 500, "RENDERER_LOAD_ERROR");

    const firstCall = writeSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected diagnostics write call");
    }
    const [payload] = firstCall;
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("sessionId");
    expect(payload).not.toHaveProperty("ipAddress");
  });

  it("swallows logging failures to avoid UI breakage", () => {
    const service = new DiagnosticsService();
    vi.spyOn(service as unknown as WriteSpyTarget, "write").mockImplementation(() => {
      throw new Error("logging failure");
    });

    expect(() => service.logAssetLoadStart("scene-001")).not.toThrow();
    expect(() => service.logAssetLoadSuccess("scene-001", 200)).not.toThrow();
    expect(() => service.logFusionModeChanged("scene-001", "single_agent")).not.toThrow();
  });
});

