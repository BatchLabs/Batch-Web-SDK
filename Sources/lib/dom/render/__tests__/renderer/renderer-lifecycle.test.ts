/* eslint-env jest */

import { makeFocusTrapPayload, makeModalPayload } from "../../test-utils/factories/renderer-payloads";
import { modalRenderer, captureAnalyticsEvents, flushPromises, getHostShadowRoot } from "../../test-utils/helpers/renderer";

describe("modalRenderer lifecycle", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;

  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    modalRenderer.hide();
    modalRenderer.setFontFamily(null);
    modalRenderer.setTheme("auto");
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("close button tracks close then dismiss", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeModalPayload());
    const closeButton = getHostShadowRoot().querySelector(".iam-close");
    if (!(closeButton instanceof HTMLButtonElement)) {
      throw new Error("close button not found");
    }
    closeButton.click();

    expect(events.map(event => event.type)).toEqual(["displayed", "close", "dismiss"]);

    unsubscribe();
  });

  test("backdrop click tracks close then dismiss", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeModalPayload());
    const backdrop = getHostShadowRoot().querySelector(".iam-backdrop");
    if (!(backdrop instanceof HTMLElement)) {
      throw new Error("backdrop not found");
    }
    backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(events.map(event => event.type)).toEqual(["displayed", "close", "dismiss"]);

    unsubscribe();
  });

  test("escape key tracks close then dismiss", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeModalPayload());
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(events.map(event => event.type)).toEqual(["displayed", "close", "dismiss"]);

    unsubscribe();
  });

  test("centered modals lock body scroll while shown and restore it on hide", async () => {
    document.body.style.overflow = "scroll";

    await modalRenderer.show(makeModalPayload({ position: "center" }));
    expect(document.body.style.overflow).toBe("hidden");

    modalRenderer.hide();
    expect(document.body.style.overflow).toBe("scroll");
  });

  test("centered modals restore body overflow after escape dismissal", async () => {
    document.body.style.overflow = "auto";

    await modalRenderer.show(makeModalPayload({ position: "center" }));
    expect(document.body.style.overflow).toBe("hidden");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.style.overflow).toBe("auto");
  });

  test("centered modals restore body overflow after backdrop dismissal", async () => {
    document.body.style.overflow = "clip";

    await modalRenderer.show(makeModalPayload({ position: "center" }));
    expect(document.body.style.overflow).toBe("hidden");

    const backdrop = getHostShadowRoot().querySelector(".iam-backdrop");
    if (!(backdrop instanceof HTMLElement)) {
      throw new Error("backdrop not found");
    }
    backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.body.style.overflow).toBe("clip");
  });

  test("centered modals restore body overflow after CTA dismissal", async () => {
    document.body.style.overflow = "";

    await modalRenderer.show(
      makeModalPayload({
        position: "center",
        actions: {
          "cta-main": {
            action: "dismiss",
          },
        },
      })
    );
    expect(document.body.style.overflow).toBe("hidden");

    const cta = getHostShadowRoot().querySelector(".iam-button");
    if (!(cta instanceof HTMLButtonElement)) {
      throw new Error("cta not found");
    }
    cta.click();

    expect(document.body.style.overflow).toBe("");
  });

  test("top modals do not lock body scroll", async () => {
    document.body.style.overflow = "auto";

    await modalRenderer.show(makeModalPayload({ position: "top" }));

    expect(document.body.style.overflow).toBe("auto");
  });

  test("bottom modals do not lock body scroll", async () => {
    document.body.style.overflow = "auto";

    await modalRenderer.show(makeModalPayload({ position: "bottom" }));

    expect(document.body.style.overflow).toBe("auto");
  });

  test("fullscreen surfaces do not lock body scroll", async () => {
    document.body.style.overflow = "auto";

    await modalRenderer.show(makeModalPayload({ format: "fullscreen" }));

    expect(document.body.style.overflow).toBe("auto");
  });

  test("tab cycles focus across all focusable elements inside the modal", async () => {
    await modalRenderer.show(makeFocusTrapPayload());
    await flushPromises();

    const shadowRoot = getHostShadowRoot();
    const firstButton = shadowRoot.querySelector<HTMLButtonElement>("button");
    if (!(firstButton instanceof HTMLButtonElement)) {
      throw new Error("Expected first modal button");
    }

    firstButton.focus();
    expect((shadowRoot.activeElement as HTMLElement | null)?.textContent?.trim()).toBe("First");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect((shadowRoot.activeElement as HTMLElement | null)?.textContent?.trim()).toBe("Second");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect((shadowRoot.activeElement as HTMLElement | null)?.getAttribute("aria-label")).toBe("Close");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect((shadowRoot.activeElement as HTMLElement | null)?.textContent?.trim()).toBe("First");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true, shiftKey: true }));
    expect((shadowRoot.activeElement as HTMLElement | null)?.getAttribute("aria-label")).toBe("Close");
  });

  test("tab trap ignores disconnected focusable elements", async () => {
    await modalRenderer.show(makeFocusTrapPayload());
    await flushPromises();

    const shadowRoot = getHostShadowRoot();
    const buttons = Array.from(shadowRoot.querySelectorAll<HTMLButtonElement>("button"));
    const firstButton = buttons.find(button => button.textContent?.trim() === "First");
    const secondButton = buttons.find(button => button.textContent?.trim() === "Second");
    const closeButton = shadowRoot.querySelector<HTMLButtonElement>(".iam-close");

    if (
      !(firstButton instanceof HTMLButtonElement) ||
      !(secondButton instanceof HTMLButtonElement) ||
      !(closeButton instanceof HTMLButtonElement)
    ) {
      throw new Error("Expected focus trap buttons");
    }

    secondButton.remove();
    firstButton.focus();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(shadowRoot.activeElement).toBe(closeButton);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true, shiftKey: true }));
    expect(shadowRoot.activeElement).toBe(firstButton);
  });

  test("a second show() replaces the first (dismissed, then the new message displays)", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    const p1 = modalRenderer.show(makeModalPayload({ trackingId: "first" }));
    const p2 = modalRenderer.show(makeModalPayload({ trackingId: "second" }));

    await Promise.all([p1, p2]);

    const displayed = events.filter(e => e.type === "displayed");
    expect(displayed.map(e => e.id)).toEqual(["first", "second"]);
    expect(events.some(e => e.type === "dismiss" && e.id === "first")).toBe(true);
    expect(document.getElementById("batchsdk-messaging-host")).not.toBeNull();

    unsubscribe();
  });
});
