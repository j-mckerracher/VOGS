import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = "scripts/check-asset-budget.mjs";

describe("check-asset-budget script", () => {
  it("exits with code 1 when a scene exceeds 2MB", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "budget-check-fail-"));
    try {
      const manifestPath = join(tempDir, "scene-manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            version: "1.0.0",
            generatedAt: "2026-02-16T00:00:00.000Z",
            scenes: [
              {
                sceneId: "oversized-scene",
                displayName: "Oversized Scene",
                defaultFusionMode: "vogs",
                defaultRepresentationMode: "gaussian",
                assets: [
                  { id: "asset-1", url: "https://example.com/scene-a.ply", sizeBytes: 1_500_000 },
                  { id: "asset-2", url: "https://example.com/scene-b.ply", sizeBytes: 600_001 }
                ]
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );

      const result = spawnSync(process.execPath, [SCRIPT_PATH], {
        cwd: process.cwd(),
        env: { ...process.env, SCENE_MANIFEST_PATH: manifestPath },
        encoding: "utf8"
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("ASSET_BUDGET_ERROR");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("exits with code 0 when all scenes are within 2MB", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "budget-check-pass-"));
    try {
      const manifestPath = join(tempDir, "scene-manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            version: "1.0.0",
            generatedAt: "2026-02-16T00:00:00.000Z",
            scenes: [
              {
                sceneId: "compliant-scene",
                displayName: "Compliant Scene",
                defaultFusionMode: "single_agent",
                defaultRepresentationMode: "occupancy",
                assets: [{ id: "asset-1", url: "https://example.com/scene-a.ply", sizeBytes: 1_000_000 }]
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );

      const result = spawnSync(process.execPath, [SCRIPT_PATH], {
        cwd: process.cwd(),
        env: { ...process.env, SCENE_MANIFEST_PATH: manifestPath },
        encoding: "utf8"
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Asset budget check passed");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
