/* eslint-env jest */

import { MessageAnalyticsWrapper, MessageCloseErrorCause } from "com.batch.dom/render/analytics/analytics-wrapper";
import { InlineLandingSurfaceStrategy } from "com.batch.dom/render/runtime/surface/inline-landing-surface-strategy";
import { ModalSurfaceStrategy } from "com.batch.dom/render/runtime/surface/modal-surface-strategy";
import { Log } from "com.batch.shared/logger";

import { makeModalPayload } from "../../test-utils/factories/renderer-payloads";
import { captureAnalyticsEvents, flushPromises, getHostShadowRoot, modalRenderer } from "../../test-utils/helpers/renderer";

interface WindowListenerEntry {
  type: string;
  listener: unknown;
}

function trackWindowListeners(): { leaked: () => string[] } {
  const live: WindowListenerEntry[] = [];
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);

  jest
    .spyOn(window, "addEventListener")
    .mockImplementation((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void => {
      live.push({ type, listener });
      nativeAdd(type, listener, options);
    });

  jest
    .spyOn(window, "removeEventListener")
    .mockImplementation((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void => {
      const index = live.findIndex(entry => entry.type === type && entry.listener === listener);
      if (index >= 0) {
        live.splice(index, 1);
      }
      nativeRemove(type, listener, options);
    });

  return { leaked: () => live.map(entry => entry.type) };
}

function throwOnMountOnce(): void {
  jest.spyOn(ModalSurfaceStrategy.prototype, "attach").mockImplementationOnce(() => {
    throw new Error("mount rejected");
  });
}

describe("modalRenderer teardown ownership", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;

  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    modalRenderer.hide();
    modalRenderer.setFontFamily(null);
    modalRenderer.setTheme("auto");
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("a surface whose attach throws leaves no window listener behind, and the next show works", async () => {
    const { leaked } = trackWindowListeners();
    throwOnMountOnce();

    await expect(modalRenderer.show(makeModalPayload())).rejects.toThrow("mount rejected");

    expect(leaked()).toEqual([]);

    const { events, unsubscribe } = captureAnalyticsEvents();
    await modalRenderer.show(makeModalPayload({ trackingId: "second" }));
    expect(document.getElementById("batchsdk-messaging-host")).not.toBeNull();
    expect(events.map(event => event.type)).toEqual(["displayed"]);
    unsubscribe();
  });

  test("a surface whose attach throws restores the body scroll lock it took", async () => {
    document.body.style.overflow = "scroll";
    throwOnMountOnce();

    await expect(modalRenderer.show(makeModalPayload({ position: "center" }))).rejects.toThrow("mount rejected");

    expect(document.body.style.overflow).toBe("scroll");
  });

  test("an unhandled CTA error reports close_error and dismiss instead of vanishing silently", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();
    jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

    await modalRenderer.show(makeModalPayload({ actions: {} }));
    jest.spyOn(MessageAnalyticsWrapper.prototype, "trackClicked").mockImplementation(() => {
      throw new Error("sink exploded");
    });

    const ctaButton = getHostShadowRoot().querySelector(".iam-button");
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("cta button not found");
    }
    ctaButton.click();
    await flushPromises();

    const closeError = events.find(event => event.type === "close_error");
    expect(closeError).toMatchObject({ cause: MessageCloseErrorCause.Unknown });
    expect(events.some(event => event.type === "dismiss")).toBe(true);
    expect(document.getElementById("batchsdk-messaging-host")).toBeNull();

    unsubscribe();
  });
});

describe("InlineLandingSurfaceStrategy mount resolution", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test.each(["[data-mount=batch lp root]", "1root", "#", "div:has-not(x)"])(
    "falls back to <body> and logs instead of throwing on the invalid selector %s",
    invalidSelector => {
      const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
      const host = document.createElement("main");

      expect(() => new InlineLandingSurfaceStrategy(invalidSelector).attach(host)).not.toThrow();

      expect(host.parentElement).toBe(document.body);
      expect(publicErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`mount container "${invalidSelector}" not found`));
    }
  );

  test("resolves a valid selector to its mount container", () => {
    const mount = document.createElement("div");
    mount.setAttribute("data-mount", "batch-lp-root");
    document.body.appendChild(mount);

    const host = document.createElement("main");
    new InlineLandingSurfaceStrategy(`[data-mount="batch-lp-root"]`).attach(host);

    expect(host.parentElement).toBe(mount);
  });
});
