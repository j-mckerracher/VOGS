import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT_DIR = resolve(process.cwd());
const HERO_TEMPLATE_PATH = resolve(ROOT_DIR, "src/app/features/hero/hero-section.component.html");
const HERO_COMPONENT_PATH = resolve(ROOT_DIR, "src/app/features/hero/hero-section.component.ts");
const APP_DIR = resolve(ROOT_DIR, "src/app");

const HERO_REQUIRED_SNIPPETS = [
  "Collaborative Perception Demo: Bandwidth vs. Clarity",
  "Vision-Only Gaussian Splatting for Collaborative Semantic Occupancy Prediction",
  "<div class=\"stat-number\">+1.9</div>",
  "<div class=\"stat-label\">mIoU Improvement</div>",
  "<div class=\"stat-number\">~35%</div>",
  "<div class=\"stat-label\">Bandwidth Usage</div>",
  "<div class=\"stat-number\">3D</div>",
  "<div class=\"stat-label\">Gaussian Primitives</div>",
  "View Demo"
];

const COMPONENT_REQUIRED_SNIPPETS = [
  "@Output() readonly viewDemo = new EventEmitter<void>();",
  "onViewDemoClick(): void",
  "this.viewDemo.emit();",
  "document.getElementById(\"demo-section\")"
];

const errors = [];

const heroTemplate = readUtf8(HERO_TEMPLATE_PATH, errors);
const heroComponent = readUtf8(HERO_COMPONENT_PATH, errors);

if (heroTemplate !== null) {
  for (const snippet of HERO_REQUIRED_SNIPPETS) {
    if (!heroTemplate.includes(snippet)) {
      errors.push(`Missing canonical hero copy snippet: ${snippet}`);
    }
  }

  const heroMetricMatches = heroTemplate.match(/\+1\.9/g) ?? [];
  if (heroMetricMatches.length !== 1) {
    errors.push(`Expected hero template to contain '+1.9' exactly once, found ${heroMetricMatches.length}.`);
  }
}

if (heroComponent !== null) {
  for (const snippet of COMPONENT_REQUIRED_SNIPPETS) {
    if (!heroComponent.includes(snippet)) {
      errors.push(`Missing hero transition contract snippet: ${snippet}`);
    }
  }
}

const plusMetricLocations = [];
for (const filePath of walkFiles(APP_DIR)) {
  const relPath = normalizePath(relative(ROOT_DIR, filePath));
  if (relPath.endsWith(".spec.ts")) {
    continue;
  }

  if (relPath === "src/app/features/hero/hero-section.component.html") {
    continue;
  }

  const contents = readUtf8(filePath, errors);
  if (contents !== null && contents.includes("+1.9")) {
    plusMetricLocations.push(relPath);
  }
}

if (plusMetricLocations.length > 0) {
  errors.push(
    `Unauthorized '+1.9' hero copy found outside hero template: ${plusMetricLocations.join(", ")}`
  );
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(` ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(" Hero integrity check passed.");
}

function readUtf8(filePath, issues) {
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    issues.push(`Unable to read ${normalizePath(relative(ROOT_DIR, filePath))}: ${formatError(error)}`);
    return null;
  }
}

function walkFiles(directoryPath) {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const filePaths = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...walkFiles(entryPath));
      continue;
    }

    filePaths.push(entryPath);
  }

  return filePaths;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}
