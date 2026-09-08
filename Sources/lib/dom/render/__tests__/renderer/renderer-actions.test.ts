/* eslint-env jest */

import { MessageActionExecutor } from "com.batch.shared/actions/executor";
import { Log } from "com.batch.shared/logger";

import { makeModalPayload } from "../../test-utils/factories/renderer-payloads";
import { modalRenderer, captureAnalyticsEvents, flushPromises, getHostShadowRoot } from "../../test-utils/helpers/renderer";

describe("modalRenderer CTA actions", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

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
    delete (window as unknown as { batchSDK?: unknown }).batchSDK;
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      delete (navigator as unknown as { clipboard?: Clipboard }).clipboard;
    }
    jest.restoreAllMocks();
  });

  test("cta tracks cta_action then dismiss with cta payload", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeModalPayload());
    const ctaButton = getHostShadowRoot().querySelector(".iam-button");
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("cta button not found");
    }
    ctaButton.click();
    await flushPromises();

    expect(events.map(event => event.type)).toEqual(["displayed", "clicked", "dismiss"]);
    expect(events[1]).toMatchObject({
      type: "clicked",
      ctaId: "cta-main",
      ctaType: "button",
      action: "batch.deeplink",
      value: "https://cta.example.test",
    });
    expect(openSpy).toHaveBeenCalledWith("https://cta.example.test", "_blank", "noopener");

    unsubscribe();
  });

  test("clipboard cta copies params.t then tracks cta_action and dismiss", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(
      makeModalPayload({
        actions: {
          "cta-main": {
            action: "batch.clipboard",
            params: {
              t: "PROMO2024",
            },
          },
        },
      })
    );
    const ctaButton = getHostShadowRoot().querySelector(".iam-button");
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("cta button not found");
    }
    ctaButton.click();
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith("PROMO2024");
    expect(events.map(event => event.type)).toEqual(["displayed", "clicked", "dismiss"]);
    expect(events[1]).toMatchObject({
      type: "clicked",
      ctaId: "cta-main",
      ctaType: "button",
      action: "batch.clipboard",
      value: "PROMO2024",
    });

    unsubscribe();
  });

  test("clipboard cta accepts params.text fallback", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await modalRenderer.show(
      makeModalPayload({
        actions: {
          "cta-main": {
            action: "batch.clipboard",
            params: {
              text: "PROMO-TEXT",
            },
          },
        },
      })
    );
    const ctaButton = getHostShadowRoot().querySelector(".iam-button");
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("cta button not found");
    }
    ctaButton.click();
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith("PROMO-TEXT");
  });

  test("clipboard cta rejection reports the click, then close_error and dismiss", async () => {
    const writeText = jest.fn().mockRejectedValue(new Error("NotAllowedError"));
    const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(
      makeModalPayload({
        actions: {
          "cta-main": {
            action: "batch.clipboard",
            params: {
              t: "PROMO2024",
            },
          },
        },
      })
    );
    const ctaButton = getHostShadowRoot().querySelector(".iam-button");
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("cta button not found");
    }
    ctaButton.click();
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith("PROMO2024");
    expect(publicErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Message action 'batch.clipboard' failed"));
    expect(events.map(event => event.type)).toEqual(["displayed", "clicked", "close_error", "dismiss"]);

    unsubscribe();
  });

  test("a submit success carrying a redirect navigates in the page once the form has its feedback", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    const executeSpy = jest.spyOn(MessageActionExecutor.prototype, "execute").mockResolvedValue({
      kind: "form-feedback",
      status: "success",
      openWindow: { url: "https://batch.com/thanks", target: "_self", features: "noopener" },
    });
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(
      makeModalPayload({
        root: {
          children: [
            { type: "field", id: "email", mapsTo: "email_map", fieldType: "email" },
            { type: "button", id: "submit", backgroundColor: ["#0044FFFF"], textColor: ["#FFFFFFFF"], fontSize: 14 },
          ],
        },
        texts: { submit: "Send" },
        actions: {
          submit: {
            action: "batch.group",
            params: {
              actions: [
                ["batch.form.submit", {}],
                ["batch.deeplink", { l: "https://batch.com/thanks", li: true }],
              ],
            },
          },
        },
      })
    );
    const submit = getHostShadowRoot().querySelector(".iam-button");
    if (!(submit instanceof HTMLButtonElement)) {
      throw new Error("submit button not found");
    }
    submit.click();
    await flushPromises();

    expect(executeSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "batch.group" }), { formFields: {} });
    expect(events.map(event => event.type)).toEqual(["displayed", "clicked"]);
    expect(events[1]).toMatchObject({ type: "clicked", ctaId: "submit", action: "batch.form.submit" });
    expect(openSpy).toHaveBeenCalledWith("https://batch.com/thanks", "_self", "noopener");
    expect(getHostShadowRoot().querySelector(".iam-form--completed")).not.toBeNull();

    unsubscribe();
  });

  test("request_notifications cta shows the native prompt then tracks cta_action and dismiss", async () => {
    const executeSpy = jest.spyOn(MessageActionExecutor.prototype, "execute").mockResolvedValue({ kind: "dismiss" });
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(
      makeModalPayload({
        actions: {
          "cta-main": {
            action: "batch.request_notifications",
          },
        },
      })
    );
    const ctaButton = getHostShadowRoot().querySelector(".iam-button");
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("cta button not found");
    }
    ctaButton.click();
    await flushPromises();

    expect(executeSpy).toHaveBeenCalledWith({
      action: "batch.request_notifications",
      args: undefined,
    });
    expect(events.map(event => event.type)).toEqual(["displayed", "clicked", "dismiss"]);
    expect(events[1]).toMatchObject({
      type: "clicked",
      ctaId: "cta-main",
      ctaType: "button",
      action: "batch.request_notifications",
    });

    unsubscribe();
  });

  test("request_notifications cta ui.show failure reports the click, then close_error and dismiss", async () => {
    const executeSpy = jest.spyOn(MessageActionExecutor.prototype, "execute").mockRejectedValue(new Error("ui.show failed"));
    const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(
      makeModalPayload({
        actions: {
          "cta-main": {
            action: "batch.request_notifications",
          },
        },
      })
    );
    const ctaButton = getHostShadowRoot().querySelector(".iam-button");
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("cta button not found");
    }
    ctaButton.click();
    await flushPromises();

    expect(executeSpy).toHaveBeenCalledWith({
      action: "batch.request_notifications",
      args: undefined,
    });
    expect(publicErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Message action 'batch.request_notifications' failed"));
    expect(events.map(event => event.type)).toEqual(["displayed", "clicked", "close_error", "dismiss"]);

    unsubscribe();
  });
});
