import { describe, expect, it, vi } from "vitest";
import { of } from "rxjs";
import "@angular/compiler";
import { AssetFetchError } from "../../core/errors/asset-fetch.error";
import { ERROR_OVERLAY_COPY, restoreFocusedElement, trapFocusInContainer } from "./error-overlay.component";
import { ViewportComponent } from "./viewport.component";

describe("Error overlay + viewport behavior", () => {
  it("uses the exact required fallback copy", () => {
    expect(ERROR_OVERLAY_COPY).toBe(
      "Unable to retrieve 3D scene data. Please check your connection or try again later."
    );
  });

  it("retry triggers one new load attempt via retryLast API", () => {
    const retryLast = vi.fn(() =>
      of(
        { type: "loading" } as const,
        {
          type: "failed",
          error: new AssetFetchError("network issue", 503)
        } as const
      )
    );
    const setLoadState = vi.fn();
    const sceneAssetServiceMock = { retryLast };
    const fusionStoreMock = {
      loadState: () => ({ status: "failed", error: null }),
      setLoadState
    };

    const component = new ViewportComponent(sceneAssetServiceMock as never, fusionStoreMock as never);
    component.onRetryRequested();

    expect(retryLast).toHaveBeenCalledTimes(1);
    expect(setLoadState).toHaveBeenCalled();
  });

  it("traps tab focus in overlay and restores prior focus on close", () => {
    const outsideButton = globalThis.document.createElement("button");
    outsideButton.textContent = "outside";
    globalThis.document.body.appendChild(outsideButton);

    const overlayRoot = globalThis.document.createElement("section");
    overlayRoot.tabIndex = -1;
    const firstButton = globalThis.document.createElement("button");
    const lastButton = globalThis.document.createElement("button");
    overlayRoot.append(firstButton, lastButton);
    globalThis.document.body.appendChild(overlayRoot);

    outsideButton.focus();
    const previouslyFocused = globalThis.document.activeElement as HTMLElement;

    lastButton.focus();
    const tabForward = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    trapFocusInContainer(overlayRoot, tabForward);
    expect(globalThis.document.activeElement).toBe(firstButton);

    firstButton.focus();
    const tabBackward = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true });
    trapFocusInContainer(overlayRoot, tabBackward);
    expect(globalThis.document.activeElement).toBe(lastButton);

    restoreFocusedElement(previouslyFocused);
    expect(globalThis.document.activeElement).toBe(outsideButton);

    overlayRoot.remove();
    outsideButton.remove();
  });
});
