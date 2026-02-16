import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MANIFEST_PATH = "src/assets/manifests/scene-manifest.json";
const FUSION_MODES = ["single_agent", "naive_fusion", "vogs", "ground_truth"];
const REPRESENTATION_MODES = ["occupancy", "gaussian"];

export function getManifestPath() {
  const manifestPath = process.env.SCENE_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  return resolve(process.cwd(), manifestPath);
}

export function parseManifestFile(manifestPath) {
  const manifestRaw = readFileSync(manifestPath, "utf8");
  return JSON.parse(manifestRaw);
}

export function validateSceneManifest(manifest) {
  const errors = [];

  if (!isRecord(manifest)) {
    errors.push("Manifest root must be an object.");
    return errors;
  }

  if (typeof manifest.version !== "string") {
    errors.push("Manifest.version is required and must be a string.");
  }

  if (typeof manifest.generatedAt !== "string") {
    errors.push("Manifest.generatedAt is required and must be a string.");
  }

  if (!Array.isArray(manifest.scenes)) {
    errors.push("Manifest.scenes is required and must be an array.");
    return errors;
  }

  for (const [sceneIndex, scene] of manifest.scenes.entries()) {
    const scenePath = `Manifest.scenes[${sceneIndex}]`;
    if (!isRecord(scene)) {
      errors.push(`${scenePath} must be an object.`);
      continue;
    }

    if (typeof scene.sceneId !== "string") {
      errors.push(`${scenePath}.sceneId is required and must be a string.`);
    }

    if (typeof scene.displayName !== "string") {
      errors.push(`${scenePath}.displayName is required and must be a string.`);
    }

    if (typeof scene.defaultFusionMode !== "string" || !FUSION_MODES.includes(scene.defaultFusionMode)) {
      errors.push(
        `${scenePath}.defaultFusionMode must be one of: ${FUSION_MODES.join(", ")}.`
      );
    }

    if (
      typeof scene.defaultRepresentationMode !== "string" ||
      !REPRESENTATION_MODES.includes(scene.defaultRepresentationMode)
    ) {
      errors.push(
        `${scenePath}.defaultRepresentationMode must be one of: ${REPRESENTATION_MODES.join(", ")}.`
      );
    }

    if (!Array.isArray(scene.assets)) {
      errors.push(`${scenePath}.assets is required and must be an array.`);
      continue;
    }

    for (const [assetIndex, asset] of scene.assets.entries()) {
      const assetPath = `${scenePath}.assets[${assetIndex}]`;
      if (!isRecord(asset)) {
        errors.push(`${assetPath} must be an object.`);
        continue;
      }

      if (typeof asset.id !== "string") {
        errors.push(`${assetPath}.id is required and must be a string.`);
      }

      if (typeof asset.url !== "string") {
        errors.push(`${assetPath}.url is required and must be a string.`);
      }

      if (typeof asset.sizeBytes !== "number" || !Number.isFinite(asset.sizeBytes)) {
        errors.push(`${assetPath}.sizeBytes is required and must be a number.`);
      }
    }
  }

  return errors;
}

export function runManifestValidation(manifestPath = getManifestPath()) {
  const manifest = parseManifestFile(manifestPath);
  const errors = validateSceneManifest(manifest);

  if (errors.length === 0) {
    console.log("Manifest contract check passed.");
    return { ok: true, errors: [] };
  }

  console.error(`Manifest contract check failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(` - ${error}`);
  }

  return { ok: false, errors };
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runManifestValidation();
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Manifest contract check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
