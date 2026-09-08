/* eslint-env jest */

import { RENDER_FONT_CSS_PROP } from "com.batch.dom/render/render-constants";
import { Log } from "com.batch.shared/logger";

import { makeModalPayload } from "../../test-utils/factories/renderer-payloads";
import { modalRenderer } from "../../test-utils/helpers/renderer";

describe("modalRenderer theme and font", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    modalRenderer.hide();
    modalRenderer.setFontFamily(null);
    modalRenderer.setTheme("auto");
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      delete (window as Partial<Window>).matchMedia;
    }
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("setTheme updates the current host and future renders without rebuilding", async () => {
    modalRenderer.setTheme("dark");
    await modalRenderer.show(makeModalPayload());

    const host = document.getElementById("batchsdk-messaging-host");
    if (!(host instanceof HTMLElement)) {
      throw new Error("Expected in-app host");
    }

    expect(host.getAttribute("data-batch-messaging-theme")).toBe("dark");

    modalRenderer.setTheme("light");
    expect(host.getAttribute("data-batch-messaging-theme")).toBe("light");

    modalRenderer.hide();
    await modalRenderer.show(makeModalPayload());

    const nextHost = document.getElementById("batchsdk-messaging-host");
    expect(nextHost?.getAttribute("data-batch-messaging-theme")).toBe("light");
  });

  test("invalid theme mode falls back to auto", async () => {
    const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      media: "(prefers-color-scheme: dark)",
    });

    modalRenderer.setTheme("ligth" as never);
    await modalRenderer.show(makeModalPayload());

    const host = document.getElementById("batchsdk-messaging-host");
    if (!(host instanceof HTMLElement)) {
      throw new Error("Expected in-app host");
    }

    expect(warnSpy).toHaveBeenCalledWith("Messaging", 'Invalid message theme mode "ligth", falling back to "auto".');
    expect(host.getAttribute("data-batch-messaging-theme")).toBe("auto");
  });

  test("setFontFamily writes the font variable on the mounted host and on the next one", async () => {
    await modalRenderer.show(makeModalPayload());

    modalRenderer.setFontFamily("Roboto");

    const host = document.getElementById("batchsdk-messaging-host");
    if (!(host instanceof HTMLElement)) {
      throw new Error("Expected in-app host");
    }
    expect(host.style.getPropertyValue(RENDER_FONT_CSS_PROP)).toBe(`"Roboto", sans-serif`);

    modalRenderer.hide();
    await modalRenderer.show(makeModalPayload());

    const nextHost = document.getElementById("batchsdk-messaging-host");
    expect((nextHost as HTMLElement).style.getPropertyValue(RENDER_FONT_CSS_PROP)).toBe(`"Roboto", sans-serif`);
  });

  test("setFontFamily(null) clears the font variable from the mounted host", async () => {
    await modalRenderer.show(makeModalPayload());
    modalRenderer.setFontFamily("Roboto");

    modalRenderer.setFontFamily(null);

    const host = document.getElementById("batchsdk-messaging-host");
    expect((host as HTMLElement).style.getPropertyValue(RENDER_FONT_CSS_PROP)).toBe("");
  });
});
