import type { MessageModel } from "com.batch.dom/render/model/model";
import { RENDER_HOST_ID, RENDER_TEXT_KEY_CLOSE_BUTTON } from "com.batch.dom/render/render-constants";
import { renderCloseButton } from "com.batch.dom/render/render/components/close-button";
import { renderSurfaceProgressBar } from "com.batch.dom/render/render/components/progress-bar";

interface OverlayHostOptions {
  ariaLabel: string;
  className?: string;
  display?: string;
  modal?: boolean;
}

export function createOverlayHost({ ariaLabel, className, display = "block", modal = true }: OverlayHostOptions): HTMLElement {
  const host = document.createElement("div");
  host.id = RENDER_HOST_ID;
  if (className) {
    host.className = className;
  }
  host.setAttribute("role", "dialog");
  if (modal) {
    host.setAttribute("aria-modal", "true");
  }
  host.setAttribute("aria-label", ariaLabel);
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
    zIndex: "999999",
    display,
  });
  return host;
}

export function appendOptionalCloseButton(container: HTMLElement, message: MessageModel, onClose: () => void): void {
  if (!message.closeOptions.button) {
    return;
  }

  container.appendChild(
    renderCloseButton({
      opts: message.closeOptions.button,
      ariaLabel: message.texts?.[RENDER_TEXT_KEY_CLOSE_BUTTON] ?? "Close",
      onClose,
    })
  );
}

export function appendSurfaceProgress(container: HTMLElement, message: MessageModel): void {
  if (!message.closeOptions.auto) {
    return;
  }

  container.appendChild(
    renderSurfaceProgressBar({
      totalDelay: message.closeOptions.auto.delay,
      elapsed: 0,
      color: message.closeOptions.auto.color,
    })
  );
}

export function startAutoCloseTimer(delaySec: number | undefined, onAutoClose: () => void): ReturnType<typeof setTimeout> | null {
  if (delaySec === undefined || delaySec <= 0) {
    return null;
  }

  return setTimeout(() => onAutoClose(), delaySec * 1000);
}

export function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
  if (timer !== null) {
    clearTimeout(timer);
  }
  return null;
}
