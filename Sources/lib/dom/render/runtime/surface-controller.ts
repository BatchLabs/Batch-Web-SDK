import { MessageModel } from "com.batch.dom/render/model/model";
import { RENDER_TEXT_KEY_DIALOG_TITLE } from "com.batch.dom/render/render-constants";
import { ActionHandler, buildComponentTree } from "com.batch.dom/render/render/builder";

import { IS_WEBPACK_DEV_SERVER } from "../../../../config";
import { appendOptionalCloseButton, appendSurfaceProgress, clearTimer, createOverlayHost, startAutoCloseTimer } from "./runtime-dom";
import { applyContentLayout, applyRootConfigurationStyles } from "./surface/root-configuration";
import type { SurfaceContentLayout } from "./surface/surface-strategy";

import rawCss from "com.batch.dom/render/render/render.raw.css";

export interface MessageSurfaceControllerOptions {
  message: MessageModel;
  contentLayout?: SurfaceContentLayout;
  onUserClose: () => void;
  onAutoClose: () => void;
  onAction: ActionHandler;
}

/** Builds and owns the native in-app surface inside a closed shadow root. */
export class MessageSurfaceController {
  public readonly element: HTMLElement;

  private readonly message: MessageModel;
  private readonly contentLayout?: SurfaceContentLayout;
  private readonly onUserClose: () => void;
  private readonly onAutoClose: () => void;
  private readonly onAction: ActionHandler;
  private readonly host: HTMLElement;
  private readonly shadow: ShadowRoot;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private disposeForm: (() => void) | null = null;
  private readonly blocksPage: boolean;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  public constructor({ message, contentLayout, onUserClose, onAutoClose, onAction }: MessageSurfaceControllerOptions) {
    this.message = message;
    this.contentLayout = contentLayout;
    this.onUserClose = onUserClose;
    this.onAutoClose = onAutoClose;
    this.onAction = onAction;

    this.blocksPage = !(message.format === "modal" && message.position !== "center");

    this.host = createOverlayHost({
      ariaLabel: message.texts?.[RENDER_TEXT_KEY_DIALOG_TITLE] ?? "Notification",
      modal: this.blocksPage,
    });
    if (!this.blocksPage) {
      this.host.style.pointerEvents = "none";
    }

    this.shadow = this.host.attachShadow({ mode: shouldExposeMessageShadowRootForE2E() ? "open" : "closed" });
    const style = document.createElement("style");
    style.textContent = rawCss;
    this.shadow.appendChild(style);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.onUserClose();
        return;
      }

      if (e.key === "Tab" && this.blocksPage) {
        // Recompute at Tab time: fields can become disabled or enabled after the first render.
        const focusable = this._collectFocusableElements();
        if (focusable.length === 0) {
          return;
        }

        const active = this.shadow.activeElement;
        const activeIndex = focusable.findIndex(element => element === active || element.contains(active));
        const fallbackIndex = e.shiftKey ? focusable.length - 1 : 0;
        const nextIndex = activeIndex === -1 ? fallbackIndex : (activeIndex + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;

        e.preventDefault();
        focusable[nextIndex].focus();
      }
    };

    this._render();
    window.addEventListener("keydown", this.onKeyDown);

    this.autoCloseTimer = startAutoCloseTimer(message.closeOptions.auto?.delay, this.onAutoClose);

    requestAnimationFrame(() => {
      this._resetInitialScrollPosition();
      this._focusFirstElementWithoutScroll();
    });

    this.element = this.host;
  }

  public destroy(): void {
    // Detach the form before the nodes leave the DOM, so an in-flight submit sees a disposed controller.
    this.disposeForm?.();
    this.autoCloseTimer = clearTimer(this.autoCloseTimer);
    window.removeEventListener("keydown", this.onKeyDown);
    this.host.remove();
  }

  private _render(): void {
    for (const child of Array.from(this.shadow.childNodes)) {
      if (child.nodeName !== "STYLE") {
        this.shadow.removeChild(child);
      }
    }
    this.shadow.appendChild(this._buildSurface());
  }

  private _collectFocusableElements(): HTMLElement[] {
    const focusableSelector =
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
    return Array.from(this.shadow.querySelectorAll<HTMLElement>(focusableSelector));
  }

  private _buildSurface(): HTMLElement {
    const isFullscreen = this.message.format === "fullscreen";
    if (isFullscreen) {
      return this._buildContainer("iam-fullscreen", false);
    }

    if (this.message.position !== "center") {
      const layer = document.createElement("div");
      layer.className = `iam-surface-layer iam-surface-layer--${this.message.position}`;

      const modal = this._buildContainer("iam-modal", true);
      layer.appendChild(modal);
      return layer;
    }

    const backdrop = document.createElement("div");
    backdrop.className = "iam-backdrop";
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) {
        this.onUserClose();
      }
    });

    const modal = this._buildContainer("iam-modal", true);
    backdrop.appendChild(modal);
    return backdrop;
  }

  private _buildContainer(containerClass: string, isModal: boolean): HTMLElement {
    const container = document.createElement("div");
    container.className = containerClass;

    this._applyRootConfiguration(container, isModal);

    const root = buildComponentTree(this.message, this.onAction, dispose => {
      this.disposeForm = dispose;
    });
    applyContentLayout(root, this.contentLayout);
    container.appendChild(root);

    appendOptionalCloseButton(container, this.message, this.onUserClose);
    appendSurfaceProgress(container, this.message);

    return container;
  }

  private _resetInitialScrollPosition(): void {
    const scrollContainer = this.shadow.querySelector<HTMLElement>(".iam-modal, .iam-fullscreen");
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = 0;
    scrollContainer.scrollLeft = 0;
  }

  private _focusFirstElementWithoutScroll(): void {
    const firstFocusable = this._collectFocusableElements()[0];
    if (!firstFocusable) {
      return;
    }

    firstFocusable.focus({ preventScroll: true });
    this._resetInitialScrollPosition();
  }

  private _applyRootConfiguration(container: HTMLElement, isModal: boolean): void {
    applyRootConfigurationStyles(container, this.message, { box: isModal });
  }
}

function shouldExposeMessageShadowRootForE2E(): boolean {
  if (!IS_WEBPACK_DEV_SERVER || typeof window === "undefined") {
    return false;
  }

  const testFlags = window as Window & {
    __BATCH_E2E__?: {
      openMessageShadowRoot?: boolean;
    };
  };

  return testFlags.__BATCH_E2E__?.openMessageShadowRoot === true;
}
