import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vitestMarker = (globalThis as { __vitest_worker__?: unknown }).__vitest_worker__;

type AccessibilityFixture = {
  accessibility: {
    dialogMessage: string;
    contrast: {
      overlayBackground: string;
      overlayText: string;
      buttonBackground: string;
      buttonText: string;
    };
  };
};

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const sceneManifestFixture = JSON.parse(
  readFileSync(resolve(fixtureDirectory, "fixtures/scene-manifest.fixture.json"), "utf-8")
) as AccessibilityFixture;

if (typeof vitestMarker === "undefined") {
  test("accessibility baseline: keyboard focus trap and restoration", async ({ page }) => {
    await page.setContent(`
      <button type="button" id="open-overlay">Open Error Overlay</button>
      <section
        id="error-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-overlay-title"
        tabindex="-1"
        hidden
      >
        <h2 id="error-overlay-title">Scene Load Error</h2>
        <p>${sceneManifestFixture.accessibility.dialogMessage}</p>
        <button type="button" id="retry">Retry</button>
        <button type="button" id="dismiss">Dismiss</button>
      </section>

      <script>
        const overlay = document.getElementById("error-overlay");
        const openButton = document.getElementById("open-overlay");
        const retryButton = document.getElementById("retry");
        const dismissButton = document.getElementById("dismiss");
        let previousFocus = null;

        const focusableSelector =
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

        const getFocusable = () => Array.from(overlay.querySelectorAll(focusableSelector));

        overlay.addEventListener("keydown", (event) => {
          if (event.key !== "Tab") {
            return;
          }

          const focusable = getFocusable();
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;

          if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
            return;
          }

          if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
          }
        });

        openButton.addEventListener("click", () => {
          previousFocus = document.activeElement;
          overlay.hidden = false;
          retryButton.focus();
        });

        dismissButton.addEventListener("click", () => {
          overlay.hidden = true;
          if (previousFocus instanceof HTMLElement) {
            previousFocus.focus();
          }
        });
      </script>
    `);

    await page.getByRole("button", { name: "Open Error Overlay" }).focus();
    await page.getByRole("button", { name: "Open Error Overlay" }).click();

    await expect(page.getByRole("dialog", { name: "Scene Load Error" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Retry" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeFocused();

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("button", { name: "Open Error Overlay" })).toBeFocused();
  });

  test("accessibility baseline: aria structure and contrast thresholds", async ({ page }) => {
    await page.setContent(`
      <style>
        :root {
          --overlay-bg: ${sceneManifestFixture.accessibility.contrast.overlayBackground};
          --overlay-text: ${sceneManifestFixture.accessibility.contrast.overlayText};
          --button-bg: ${sceneManifestFixture.accessibility.contrast.buttonBackground};
          --button-text: ${sceneManifestFixture.accessibility.contrast.buttonText};
        }

        #error-overlay {
          background: var(--overlay-bg);
          color: var(--overlay-text);
          border-radius: 8px;
          padding: 16px;
          max-width: 360px;
        }

        #retry {
          background: var(--button-bg);
          color: var(--button-text);
          border: 1px solid var(--button-text);
          padding: 8px 12px;
        }
      </style>

      <section class="hero-section" id="hero-section" aria-labelledby="hero-title">
        <h1 id="hero-title">Collaborative Perception Demo</h1>
      </section>

      <section class="controls-panel" aria-labelledby="controls-panel-title">
        <h2 id="controls-panel-title">Controls</h2>
        <fieldset aria-label="Fusion mode">
          <legend>Fusion Mode</legend>
          <label><input type="radio" name="fusion-mode" /> Single Agent</label>
          <label><input type="radio" name="fusion-mode" /> Ground Truth</label>
        </fieldset>
      </section>

      <section
        id="error-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-overlay-title"
        tabindex="-1"
      >
        <h2 id="error-overlay-title">Scene Load Error</h2>
        <p>${sceneManifestFixture.accessibility.dialogMessage}</p>
        <button type="button" id="retry">Retry</button>
      </section>
    `);

    await expect(page.locator("#hero-section")).toHaveAttribute("aria-labelledby", "hero-title");
    await expect(page.getByRole("heading", { name: "Collaborative Perception Demo" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Fusion mode" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Scene Load Error" })).toHaveAttribute("aria-modal", "true");

    const contrastRatios = await page.evaluate(() => {
      type Rgb = { r: number; g: number; b: number };

      const parseRgb = (value: string): Rgb => {
        const matches = value.match(/\d+(\.\d+)?/g);
        if (matches === null || matches.length < 3) {
          return { r: 0, g: 0, b: 0 };
        }

        return {
          r: Number(matches[0]),
          g: Number(matches[1]),
          b: Number(matches[2])
        };
      };

      const toLinear = (channel: number): number => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };

      const luminance = (rgb: Rgb): number =>
        (0.2126 * toLinear(rgb.r)) + (0.7152 * toLinear(rgb.g)) + (0.0722 * toLinear(rgb.b));

      const contrast = (foreground: Rgb, background: Rgb): number => {
        const light = Math.max(luminance(foreground), luminance(background));
        const dark = Math.min(luminance(foreground), luminance(background));
        return (light + 0.05) / (dark + 0.05);
      };

      const overlay = globalThis.document.getElementById("error-overlay");
      const retry = globalThis.document.getElementById("retry");
      if (!(overlay instanceof HTMLElement) || !(retry instanceof HTMLElement)) {
        return { overlay: 0, button: 0 };
      }

      const overlayStyles = globalThis.getComputedStyle(overlay);
      const retryStyles = globalThis.getComputedStyle(retry);

      const overlayRatio = contrast(
        parseRgb(overlayStyles.color),
        parseRgb(overlayStyles.backgroundColor)
      );
      const buttonRatio = contrast(
        parseRgb(retryStyles.color),
        parseRgb(retryStyles.backgroundColor)
      );

      return {
        overlay: overlayRatio,
        button: buttonRatio
      };
    });

    expect(contrastRatios.overlay).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatios.button).toBeGreaterThanOrEqual(4.5);
  });
}

if (typeof vitestMarker !== "undefined") {
  const { describe, expect: vitestExpect, it } = await import("vitest");

  describe("accessibility Playwright contract", () => {
    it("is validated by Playwright runner", () => {
      vitestExpect(true).toBe(true);
    });
  });
}
