/* eslint-env jest */

import type { ActionOutcome } from "com.batch.dom/render/contracts";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { MessageSurfaceController } from "com.batch.dom/render/runtime/surface-controller";
import { Log } from "com.batch.shared/logger";

const nativeAttachShadow = Element.prototype.attachShadow;

function makeMessage(overrides: Record<string, unknown> = {}) {
  return normalizeMessage({
    format: "modal",
    root: { children: [] },
    closeOptions: {},
    texts: {},
    urls: {},
    actions: {},
    ...overrides,
  });
}

function pressKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

function makeFormMessage() {
  return makeMessage({
    root: {
      children: [
        { type: "field", id: "email" },
        { type: "button", id: "submit", backgroundColor: ["#000000FF"], textColor: ["#FFFFFFFF"], fontSize: 16 },
      ],
    },
    texts: { submit: "Send" },
    actions: { submit: { action: "batch.form.submit" } },
  });
}

function makeDeferredAction(): { onAction: jest.Mock; resolve: (outcome: ActionOutcome) => void; reject: (failure: Error) => void } {
  let settle!: (outcome: ActionOutcome) => void;
  let fail!: (failure: Error) => void;
  const onAction = jest.fn(
    () =>
      new Promise<ActionOutcome>((resolve, reject) => {
        settle = resolve;
        fail = reject;
      })
  );
  return { onAction, resolve: outcome => settle(outcome), reject: failure => fail(failure) };
}

async function settleSubmit(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("MessageSurfaceController", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("renders a backdrop only for centered modals", () => {
    const centeredController = new MessageSurfaceController({
      message: makeMessage({ position: "center" }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const topController = new MessageSurfaceController({
      message: makeMessage({ position: "top" }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const centeredShadow = centeredController.element.shadowRoot;
    const topShadow = topController.element.shadowRoot;

    expect(centeredShadow?.querySelector(".iam-backdrop")).toBeInstanceOf(HTMLElement);
    expect(centeredShadow?.querySelector(".iam-surface-layer")).toBeNull();

    expect(topShadow?.querySelector(".iam-backdrop")).toBeNull();
    expect(topShadow?.querySelector(".iam-surface-layer")).toBeInstanceOf(HTMLElement);
    expect(topShadow?.querySelector(".iam-surface-layer--top")).toBeInstanceOf(HTMLElement);

    centeredController.destroy();
    topController.destroy();
  });

  test("top and bottom modals do not close on outside tap and do not block page interactions", () => {
    const onUserClose = jest.fn();
    const controller = new MessageSurfaceController({
      message: makeMessage({ position: "top" }),
      onUserClose,
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const shadow = controller.element.shadowRoot;
    const surfaceLayer = shadow?.querySelector(".iam-surface-layer");

    expect(controller.element.style.pointerEvents).toBe("none");
    expect(surfaceLayer).toBeInstanceOf(HTMLElement);
    expect(surfaceLayer?.classList.contains("iam-surface-layer--top")).toBe(true);

    surfaceLayer?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onUserClose).not.toHaveBeenCalled();

    controller.destroy();
  });

  test("bottom modals use a dedicated edge-aligned surface layer", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({ position: "bottom" }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const shadow = controller.element.shadowRoot;

    expect(shadow?.querySelector(".iam-surface-layer--bottom")).toBeInstanceOf(HTMLElement);

    controller.destroy();
  });

  test("resets scroll to top on first render for scrollable surfaces", () => {
    const frames: FrameRequestCallback[] = [];
    window.requestAnimationFrame = jest.fn().mockImplementation(callback => {
      frames.push(callback);
      return 1;
    });

    const focusSpy = jest.spyOn(HTMLButtonElement.prototype, "focus").mockImplementation(function (
      this: HTMLButtonElement,
      options?: FocusOptions
    ): void {
      const scrollContainer = this.closest(".iam-modal, .iam-fullscreen") as HTMLElement | null;
      if (scrollContainer && !options?.preventScroll) {
        scrollContainer.scrollTop = 120;
      }
    });

    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          children: [
            {
              type: "spacer",
              height: { px: 600 },
            },
            {
              id: "cta",
              type: "button",
              backgroundColor: ["#000000"],
              textColor: ["#FFFFFF"],
              fontSize: 14,
            },
          ],
        },
        texts: { cta: "Open" },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    document.body.appendChild(controller.element);

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement | null;
    const frame = frames[0];
    if (!modal || !frame) {
      throw new Error("expected modal and first animation frame");
    }

    modal.scrollTop = 80;
    frame(0);

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(modal.scrollTop).toBe(0);

    controller.destroy();
  });

  test("applies root background color theme vars on modal surface", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          backgroundColor: ["#FFFFFFFF", "#000000FF"],
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement;
    expect(modal.style.getPropertyValue("--iam-surface-bg")).toBe("rgba(255,255,255,1.000)");
    expect(modal.style.getPropertyValue("--iam-surface-bg-dark")).toBe("rgba(0,0,0,1.000)");

    controller.destroy();
  });

  test("applies root radius on modal surface", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          radius: [12, 12, 12, 12],
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement;
    expect(modal.style.borderRadius).toBe("12px 12px 12px 12px");

    controller.destroy();
  });

  test("applies border width and solid style when root borderWidth is positive", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          borderWidth: 2,
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement;
    expect(modal.style.borderWidth).toBe("2px");
    expect(modal.style.borderStyle).toBe("solid");

    controller.destroy();
  });

  test("writes border color theme vars when root borderWidth is positive", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          borderWidth: 2,
          borderColor: ["#FF0000FF"],
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement;
    expect(modal.style.getPropertyValue("--iam-surface-border-color")).toBe("rgba(255,0,0,1.000)");

    controller.destroy();
  });

  test("leaves the component root uncapped when no content layout is granted", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage(),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const root = controller.element.shadowRoot?.querySelector(".iam-root") as HTMLElement;
    expect(root.classList.contains("iam-root--capped")).toBe(false);
    expect(root.style.getPropertyValue("--iam-content-max-width")).toBe("");

    controller.destroy();
  });

  test("caps the component root when a surface grants a content layout", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage(),
      contentLayout: { maxWidth: 720 },
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const root = controller.element.shadowRoot?.querySelector(".iam-root") as HTMLElement;
    expect(root.classList.contains("iam-root--capped")).toBe(true);
    expect(root.style.getPropertyValue("--iam-content-max-width")).toBe("720px");

    controller.destroy();
  });

  test("does not apply solid border style when borderWidth is zero", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          borderWidth: 0,
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement;
    expect(modal.style.borderStyle).toBe("");

    controller.destroy();
  });

  test("applies root margin on modal surfaces", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          margin: [16, 8, 16, 8],
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement;
    expect(modal.style.getPropertyValue("--iam-root-margin")).toBe("16px 8px 16px 8px");
    expect(modal.style.getPropertyValue("--iam-root-margin-desktop")).toBe("16px 8px 16px 8px");

    controller.destroy();
  });

  test("applies the desktop root margin variable when provided", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        root: {
          margin: [16, 8, 16, 8],
          marginDesktop: [32, 16, 32, 16],
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const modal = controller.element.shadowRoot?.querySelector(".iam-modal") as HTMLElement;
    expect(modal.style.getPropertyValue("--iam-root-margin")).toBe("16px 8px 16px 8px");
    expect(modal.style.getPropertyValue("--iam-root-margin-desktop")).toBe("32px 16px 32px 16px");

    controller.destroy();
  });

  test("fullscreen surfaces ignore modal margin and radius styling", () => {
    const controller = new MessageSurfaceController({
      message: makeMessage({
        format: "fullscreen",
        root: {
          margin: [16, 8, 16, 8],
          radius: [12, 12, 12, 12],
          children: [],
        },
      }),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const fullscreen = controller.element.shadowRoot?.querySelector(".iam-fullscreen") as HTMLElement;
    expect(fullscreen.style.margin).toBe("");
    expect(fullscreen.style.borderRadius).toBe("");

    controller.destroy();
  });

  test("arms the auto-close timer and invokes onAutoClose once the delay elapses", () => {
    jest.useFakeTimers();
    const onAutoClose = jest.fn();
    const controller = new MessageSurfaceController({
      message: makeMessage({ closeOptions: { auto: { delay: 5 } } }),
      onUserClose: jest.fn(),
      onAutoClose,
      onAction: jest.fn(),
    });

    expect(onAutoClose).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(onAutoClose).toHaveBeenCalledTimes(1);

    controller.destroy();
    jest.useRealTimers();
  });

  test("destroy clears the auto-close timer so onAutoClose never fires", () => {
    jest.useFakeTimers();
    const onAutoClose = jest.fn();
    const controller = new MessageSurfaceController({
      message: makeMessage({ closeOptions: { auto: { delay: 5 } } }),
      onUserClose: jest.fn(),
      onAutoClose,
      onAction: jest.fn(),
    });

    controller.destroy();
    jest.advanceTimersByTime(5000);

    expect(onAutoClose).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("the first-render animation frame focuses the first focusable element", () => {
    const frames: FrameRequestCallback[] = [];
    window.requestAnimationFrame = jest.fn().mockImplementation(callback => {
      frames.push(callback);
      return 1;
    });

    const focusSpy = jest.spyOn(HTMLButtonElement.prototype, "focus").mockImplementation(() => undefined);

    const controller = new MessageSurfaceController({
      message: makeMessage(),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    const frame = frames[0];
    if (!frame) {
      throw new Error("expected an animation frame to be scheduled");
    }

    frame(0);

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    controller.destroy();
  });

  test("only a surface that blocks the page claims aria-modal", () => {
    const handlers = { onUserClose: jest.fn(), onAutoClose: jest.fn(), onAction: jest.fn() };

    const centered = new MessageSurfaceController({ message: makeMessage({ position: "center" }), ...handlers });
    expect(centered.element.getAttribute("role")).toBe("dialog");
    expect(centered.element.getAttribute("aria-modal")).toBe("true");
    expect(centered.element.getAttribute("aria-label")).toBe("Notification");
    centered.destroy();

    const fullscreen = new MessageSurfaceController({ message: makeMessage({ format: "fullscreen" }), ...handlers });
    expect(fullscreen.element.getAttribute("aria-modal")).toBe("true");
    fullscreen.destroy();

    for (const position of ["top", "bottom"]) {
      const banner = new MessageSurfaceController({ message: makeMessage({ position }), ...handlers });
      expect(banner.element.style.pointerEvents).toBe("none");
      expect(banner.element.getAttribute("role")).toBe("dialog");
      expect(banner.element.hasAttribute("aria-modal")).toBe(false);
      expect(banner.element.getAttribute("aria-label")).toBe("Notification");
      banner.destroy();
    }
  });

  test("the Tab cycle is confined to the surfaces that block the page", () => {
    const handlers = { onUserClose: jest.fn(), onAutoClose: jest.fn(), onAction: jest.fn() };

    const centered = new MessageSurfaceController({ message: makeMessage({ position: "center" }), ...handlers });
    expect(centered.element.shadowRoot?.querySelector("button")).toBeInstanceOf(HTMLButtonElement);
    expect(pressKey("Tab").defaultPrevented).toBe(true);
    centered.destroy();

    for (const position of ["top", "bottom"]) {
      const banner = new MessageSurfaceController({ message: makeMessage({ position }), ...handlers });
      expect(banner.element.shadowRoot?.querySelector("button")).toBeInstanceOf(HTMLButtonElement);
      expect(pressKey("Tab").defaultPrevented).toBe(false);
      banner.destroy();
    }
  });

  test("Escape closes an anchored banner as well", () => {
    const onUserClose = jest.fn();
    const banner = new MessageSurfaceController({
      message: makeMessage({ position: "top" }),
      onUserClose,
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });

    pressKey("Escape");

    expect(onUserClose).toHaveBeenCalledTimes(1);
    banner.destroy();
  });

  test("a submit that resolves after destroy() writes nothing into the detached tree", async () => {
    const deferred = makeDeferredAction();
    const controller = new MessageSurfaceController({
      message: makeFormMessage(),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: deferred.onAction,
    });
    document.body.appendChild(controller.element);

    const shadow = controller.element.shadowRoot;
    const root = shadow?.querySelector(".iam-root") as HTMLElement;
    const feedback = shadow?.querySelector(".iam-form-message") as HTMLElement;
    const submit = shadow?.querySelector(".iam-button") as HTMLButtonElement;
    submit.click();

    expect(deferred.onAction).toHaveBeenCalledWith("submit", { formFields: {} });
    expect(root.classList.contains("iam-form--submitting")).toBe(true);

    controller.destroy();
    deferred.resolve({ kind: "form-feedback", status: "success", message: "Thanks!" });
    await settleSubmit();

    expect(document.body.contains(controller.element)).toBe(false);
    expect(root.classList.contains("iam-form--completed")).toBe(false);
    expect(feedback.textContent).toBe("");
    expect(feedback.classList.contains("iam-form-message--visible")).toBe(false);
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.classList.contains("iam-form--submitting")).toBe(true);
  });

  test("a submit that fails after destroy() reports nothing", async () => {
    const deferred = makeDeferredAction();
    const controller = new MessageSurfaceController({
      message: makeFormMessage(),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: deferred.onAction,
    });

    const shadow = controller.element.shadowRoot;
    const feedback = shadow?.querySelector(".iam-form-message") as HTMLElement;
    const submit = shadow?.querySelector(".iam-button") as HTMLButtonElement;
    submit.click();

    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    controller.destroy();
    deferred.reject(new Error("offline"));
    await settleSubmit();

    expect(warn).not.toHaveBeenCalled();
    expect(feedback.textContent).toBe("");
  });

  test("a submit that resolves before any teardown still completes the form", async () => {
    const deferred = makeDeferredAction();
    const controller = new MessageSurfaceController({
      message: makeFormMessage(),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: deferred.onAction,
    });
    document.body.appendChild(controller.element);

    const shadow = controller.element.shadowRoot;
    const root = shadow?.querySelector(".iam-root") as HTMLElement;
    const feedback = shadow?.querySelector(".iam-form-message") as HTMLElement;
    const submit = shadow?.querySelector(".iam-button") as HTMLButtonElement;
    submit.click();

    deferred.resolve({ kind: "form-feedback", status: "success", message: "Thanks!" });
    await settleSubmit();

    expect(root.classList.contains("iam-form--completed")).toBe(true);
    expect(root.getAttribute("aria-busy")).toBe("false");
    expect(feedback.textContent).toBe("Thanks!");
    expect(feedback.classList.contains("iam-form-message--visible")).toBe(true);

    controller.destroy();
  });

  test("destroy() on a message without a form removes the host and unbinds Escape", () => {
    const onUserClose = jest.fn();
    const controller = new MessageSurfaceController({
      message: makeMessage(),
      onUserClose,
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });
    document.body.appendChild(controller.element);

    expect(() => controller.destroy()).not.toThrow();

    expect(document.body.contains(controller.element)).toBe(false);
    pressKey("Escape");
    expect(onUserClose).not.toHaveBeenCalled();
  });
});
