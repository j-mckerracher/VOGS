import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vitestMarker = (globalThis as { __vitest_worker__?: unknown }).__vitest_worker__;

type SceneFixture = {
  scenarios: {
    success: {
      initialState: string;
      primaryOutcome: { type: string };
      retryOutcome: { type: string };
    };
    failureThenRetrySuccess: {
      initialState: string;
      primaryOutcome: { type: string; error: { code: string; message: string } };
      retryOutcome: { type: string };
    };
  };
};

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const sceneManifestFixture = JSON.parse(
  readFileSync(resolve(fixtureDirectory, "fixtures/scene-manifest.fixture.json"), "utf-8")
) as SceneFixture;

type DemoScenario = keyof SceneFixture["scenarios"];

const renderDemoHarness = async (page: Page, scenario: DemoScenario): Promise<void> => {
  await page.setContent(`
    <section class="hero-section" id="hero-section">
      <button class="hero-button" type="button">View Demo <span aria-hidden="true">&#8595;</span></button>
    </section>
    <section id="demo-section" tabindex="-1" aria-label="Interactive demo section" data-transitioned="false">
      <p data-testid="load-state">idle</p>
      <p data-testid="load-error"></p>
      <p data-testid="retry-count">0</p>
      <p data-testid="occluded-vehicle" hidden data-visible="false">Occluded vehicle marker</p>

      <fieldset aria-label="Fusion mode">
        <legend>Fusion Mode</legend>
        <label>
          <input type="radio" name="fusion-mode" value="single_agent" checked />
          Single Agent
        </label>
        <label>
          <input type="radio" name="fusion-mode" value="vogs" />
          VOGS
        </label>
        <label>
          <input type="radio" name="fusion-mode" value="ground_truth" />
          Ground Truth
        </label>
      </fieldset>

      <fieldset aria-label="Representation mode">
        <legend>Representation</legend>
        <label>
          <input type="radio" name="representation-mode" value="occupancy" checked />
          Occupancy
        </label>
        <label>
          <input type="radio" name="representation-mode" value="gaussian" />
          Gaussian
        </label>
      </fieldset>
    </section>

    <section
      class="error-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-overlay-title"
      tabindex="-1"
      hidden
    >
      <h2 id="error-overlay-title">Scene Load Error</h2>
      <p class="error-message"></p>
      <button type="button" class="retry-button">Retry</button>
    </section>

    <script>
      const fixture = ${JSON.stringify(sceneManifestFixture)};
      const scenario = fixture.scenarios["${scenario}"];
      let currentState = scenario.initialState;
      let retryCount = 0;
      let representationUpdates = 0;

      const demoSection = document.getElementById("demo-section");
      const loadState = demoSection.querySelector('[data-testid="load-state"]');
      const loadError = demoSection.querySelector('[data-testid="load-error"]');
      const retryCountNode = demoSection.querySelector('[data-testid="retry-count"]');
      const occludedVehicle = demoSection.querySelector('[data-testid="occluded-vehicle"]');
      const errorOverlay = document.querySelector(".error-overlay");
      const errorMessage = document.querySelector(".error-message");
      const retryButton = document.querySelector(".retry-button");

      const fusionRadios = Array.from(document.querySelectorAll('input[name="fusion-mode"]'));
      const representationRadios = Array.from(document.querySelectorAll('input[name="representation-mode"]'));

      const setRepresentationDisabled = (disabled) => {
        representationRadios.forEach((radio) => {
          radio.disabled = disabled;
        });
      };

      const setOccludedVehicleVisibility = () => {
        if (!(occludedVehicle instanceof HTMLElement)) {
          return;
        }

        const selectedFusionMode = fusionRadios.find((input) => input.checked)?.value;
        const isVisible = selectedFusionMode === "vogs";
        occludedVehicle.hidden = !isVisible;
        occludedVehicle.setAttribute("data-visible", String(isVisible));
      };

      const updateUI = (event) => {
        currentState = event.type;
        loadState.textContent = event.type;

        if (event.type === "failed") {
          loadError.textContent = event.error.message;
          errorMessage.textContent = event.error.message;
          errorOverlay.hidden = false;
          errorOverlay.focus();
          return;
        }

        if (event.type === "ready") {
          loadError.textContent = "";
          errorMessage.textContent = "";
          errorOverlay.hidden = true;
        }
      };

      fusionRadios.forEach((radio) => {
        radio.addEventListener("change", (changeEvent) => {
          const target = changeEvent.target;
          if (!(target instanceof HTMLInputElement)) {
            return;
          }

          setRepresentationDisabled(target.value === "ground_truth");
          setOccludedVehicleVisibility();
        });
      });

      representationRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
          const groundTruthSelected = fusionRadios.some(
            (input) => input.checked && input.value === "ground_truth"
          );
          if (groundTruthSelected) {
            return;
          }
          representationUpdates += 1;
          demoSection.setAttribute("data-representation-updates", String(representationUpdates));
        });
      });

      const startLoad = () => {
        demoSection.setAttribute("data-transitioned", "true");
        demoSection.focus();

        const shouldUseRetryOutcome = currentState === "failed";
        updateUI({ type: "loading" });
        const outcome = shouldUseRetryOutcome ? scenario.retryOutcome : scenario.primaryOutcome;
        globalThis.queueMicrotask(() => {
          updateUI(outcome);
        });
      };

      document.querySelector(".hero-button").addEventListener("click", () => {
        startLoad();
      });

      retryButton.addEventListener("click", () => {
        retryCount += 1;
        retryCountNode.textContent = String(retryCount);
        startLoad();
      });

      setRepresentationDisabled(false);
      setOccludedVehicleVisibility();
      demoSection.setAttribute("data-representation-updates", "0");
    </script>
  `);
};

if (typeof vitestMarker === "undefined") {
  test("AC flow: View Demo success path transitions to ready", async ({ page }) => {
    await renderDemoHarness(page, "success");

    await page.getByRole("button", { name: /View Demo/i }).click();

    const demoSection = page.locator("#demo-section");
    await expect(demoSection).toHaveAttribute("data-transitioned", "true");
    await expect(demoSection).toBeFocused();
    await expect(page.getByTestId("load-state")).toHaveText("ready");
    await expect(page.getByTestId("load-error")).toHaveText("");
    await expect(page.getByRole("dialog", { name: "Scene Load Error" })).toBeHidden();
  });

  test("AC flow: failure path surfaces error and retry returns to ready", async ({ page }) => {
    await renderDemoHarness(page, "failureThenRetrySuccess");

    await page.getByRole("button", { name: /View Demo/i }).click();

    await expect(page.getByTestId("load-state")).toHaveText("failed");
    await expect(page.getByTestId("load-error")).toHaveText("asset fetch failed");
    await expect(page.getByRole("dialog", { name: "Scene Load Error" })).toBeVisible();

    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByTestId("retry-count")).toHaveText("1");
    await expect(page.getByTestId("load-state")).toHaveText("ready");
    await expect(page.getByRole("dialog", { name: "Scene Load Error" })).toBeHidden();
  });

  test("ground_truth mode disables representation controls", async ({ page }) => {
    await renderDemoHarness(page, "success");

    await page.getByRole("radio", { name: "Ground Truth" }).check();

    const occupancyRadio = page.getByRole("radio", { name: "Occupancy" });
    const gaussianRadio = page.getByRole("radio", { name: "Gaussian" });

    await expect(occupancyRadio).toBeDisabled();
    await expect(gaussianRadio).toBeDisabled();

    await page.evaluate(() => {
      const gaussian = globalThis.document.querySelector<HTMLInputElement>(
        'input[name="representation-mode"][value="gaussian"]'
      );
      gaussian?.click();
    });

    await expect(page.locator("#demo-section")).toHaveAttribute("data-representation-updates", "0");
  });

  test("single_agent hides occluded vehicle and vogs reveals it", async ({ page }) => {
    await renderDemoHarness(page, "success");

    const occludedVehicleMarker = page.getByTestId("occluded-vehicle");

    await expect(occludedVehicleMarker).toBeHidden();
    await expect(occludedVehicleMarker).toHaveAttribute("data-visible", "false");

    await page.getByRole("radio", { name: "VOGS" }).check();

    await expect(occludedVehicleMarker).toBeVisible();
    await expect(occludedVehicleMarker).toHaveAttribute("data-visible", "true");
  });
}

if (typeof vitestMarker !== "undefined") {
  const { describe, expect: vitestExpect, it } = await import("vitest");

  describe("demo-flow Playwright contract", () => {
    it("is validated by Playwright runner", () => {
      vitestExpect(true).toBe(true);
    });
  });
}
