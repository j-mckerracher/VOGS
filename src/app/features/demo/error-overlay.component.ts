import { CommonModule } from "@angular/common";
import { Component, effect, input, output, viewChild } from "@angular/core";
import type { ElementRef } from "@angular/core";

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ERROR_OVERLAY_COPY =
  "Unable to retrieve 3D scene data. Please check your connection or try again later." as const;

export const getFocusableElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => !element.hasAttribute("disabled"));

export const trapFocusInContainer = (root: HTMLElement, event: KeyboardEvent): void => {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getFocusableElements(root);
  if (focusableElements.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = globalThis.document.activeElement;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
};

export const restoreFocusedElement = (previousFocusedElement: HTMLElement | null): void => {
  if (previousFocusedElement !== null && previousFocusedElement.isConnected) {
    previousFocusedElement.focus();
  }
};

@Component({
  selector: "app-error-overlay",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <section
        #overlayRoot
        class="error-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-overlay-title"
        tabindex="-1"
        (keydown)="onOverlayKeydown($event)"
      >
        <h2 id="error-overlay-title">Scene Load Error</h2>
        <p>{{ message }}</p>
        <button type="button" (click)="onRetryClick()">Retry</button>
      </section>
    }
  `
})
export class ErrorOverlayComponent {
  readonly open = input(false);
  readonly retryRequested = output<void>();
  private readonly overlayRoot = viewChild<ElementRef<HTMLElement>>("overlayRoot");

  readonly message = ERROR_OVERLAY_COPY;
  private previousFocusedElement: HTMLElement | null = null;
  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen === this.wasOpen) {
        return;
      }

      this.wasOpen = isOpen;
      if (isOpen) {
        this.captureFocusedElement();
        globalThis.queueMicrotask(() => {
          this.focusFirstElement();
        });
        return;
      }

      this.restoreFocus();
    });
  }

  onRetryClick(): void {
    this.retryRequested.emit();
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }

    const root = this.overlayRoot()?.nativeElement;
    if (root !== undefined) {
      trapFocusInContainer(root, event);
    }
  }

  private captureFocusedElement(): void {
    const activeElement = globalThis.document.activeElement;
    this.previousFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;
  }

  private focusFirstElement(): void {
    if (!this.open()) {
      return;
    }

    const firstElement = this.getFocusableElements()[0];
    if (firstElement !== undefined) {
      firstElement.focus();
      return;
    }

    this.overlayRoot()?.nativeElement.focus();
  }

  private restoreFocus(): void {
    restoreFocusedElement(this.previousFocusedElement);
    this.previousFocusedElement = null;
  }

  private getFocusableElements(): HTMLElement[] {
    const root = this.overlayRoot()?.nativeElement;
    if (root === undefined) {
      return [];
    }

    return getFocusableElements(root);
  }
}
