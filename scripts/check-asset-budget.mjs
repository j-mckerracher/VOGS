import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SCENE_ASSET_BUDGET_BYTES = 2_000_000;
const DEFAULT_MANIFEST_PATH = "src/assets/manifests/scene-manifest.json";

export function getManifestPath() {
  const manifestPath = process.env.SCENE_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  return resolve(process.cwd(), manifestPath);
}

export function parseManifestFile(manifestPath) {
  const manifestRaw = readFileSync(manifestPath, "utf8");
  return JSON.parse(manifestRaw);
}

export function collectSceneBudgetViolations(manifest, thresholdBytes = SCENE_ASSET_BUDGET_BYTES) {
  if (!isRecord(manifest) || !Array.isArray(manifest.scenes)) {
    throw new Error("Manifest must contain a 'scenes' array.");
  }

  const violations = [];
  for (const scene of manifest.scenes) {
    if (!isRecord(scene)) {
      throw new Error("Each scene entry must be an object.");
    }

    if (!Array.isArray(scene.assets)) {
      throw new Error(`Scene '${String(scene.sceneId ?? "unknown")}' must contain an 'assets' array.`);
    }

    const totalBytes = scene.assets.reduce((sum, asset) => {
      if (!isRecord(asset) || typeof asset.sizeBytes !== "number" || !Number.isFinite(asset.sizeBytes)) {
        throw new Error(`Scene '${String(scene.sceneId ?? "unknown")}' contains an invalid asset sizeBytes value.`);
      }
      return sum + asset.sizeBytes;
    }, 0);

    if (totalBytes > thresholdBytes) {
      violations.push({
        sceneId: String(scene.sceneId ?? "unknown"),
        displayName: String(scene.displayName ?? "Unnamed Scene"),
        totalBytes
      });
    }
  }

  return violations;
}

export function runBudgetCheck(manifestPath = getManifestPath()) {
  const manifest = parseManifestFile(manifestPath);
  const violations = collectSceneBudgetViolations(manifest);

  if (violations.length === 0) {
    console.log(
      `Asset budget check passed. All scenes are within ${SCENE_ASSET_BUDGET_BYTES.toLocaleString()} bytes.`
    );
    return { ok: true, violations: [] };
  }

  console.error(
    `ASSET_BUDGET_ERROR: ${violations.length} scene(s) exceed ${SCENE_ASSET_BUDGET_BYTES.toLocaleString()} bytes.`
  );
  for (const violation of violations) {
    console.error(
      ` - ${violation.sceneId} (${violation.displayName}): ${violation.totalBytes.toLocaleString()} bytes`
    );
  }

  return { ok: false, violations };
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runBudgetCheck();
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`ASSET_BUDGET_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
