/* eslint-env jest */

import { isDirectFontUrl, loadMessageFont, unloadMessageFonts } from "com.batch.dom/render/runtime/font-loader";
import { Log } from "com.batch.shared/logger";

interface FontFaceMockHandle {
  load: jest.Mock;
}

const QUOTED_URL_SOURCE = /^url\("(?:[^"\\]|\\.)*"\)$/;

function installFontFaceMock(load: jest.Mock): { fontFaceMock: jest.Mock; add: jest.Mock; deleteFace: jest.Mock } {
  const add = jest.fn();
  const deleteFace = jest.fn();
  const fontFaceMock = jest.fn<FontFaceMockHandle, [string, string, FontFaceDescriptors]>().mockImplementation((_family, source) => {
    if (!QUOTED_URL_SOURCE.test(source)) {
      throw new SyntaxError(`Invalid font source: ${source}`);
    }
    return { load };
  });

  Object.defineProperty(globalThis, "FontFace", {
    configurable: true,
    writable: true,
    value: fontFaceMock,
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { add, delete: deleteFace, ready: Promise.resolve() },
  });

  return { fontFaceMock, add, deleteFace };
}

describe("font loader", () => {
  const originalFontFace = globalThis.FontFace;
  const originalDocumentFonts = document.fonts;

  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { add: jest.fn(), delete: jest.fn(), ready: Promise.resolve() },
    });
  });

  afterEach(() => {
    unloadMessageFonts();
    if (originalFontFace) {
      Object.defineProperty(globalThis, "FontFace", { configurable: true, writable: true, value: originalFontFace });
    } else {
      Reflect.deleteProperty(globalThis, "FontFace");
    }
    Object.defineProperty(document, "fonts", { configurable: true, value: originalDocumentFonts });
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("isDirectFontUrl", () => {
    test("matches direct font files, including with query strings, and rejects stylesheets", () => {
      expect(isDirectFontUrl("https://f.test/a.woff2")).toBe(true);
      expect(isDirectFontUrl("https://f.test/a.woff")).toBe(true);
      expect(isDirectFontUrl("https://f.test/a.ttf?v=2")).toBe(true);
      expect(isDirectFontUrl("https://f.test/a.otf")).toBe(true);
      expect(isDirectFontUrl("https://f.test/a.eot")).toBe(true);
      expect(isDirectFontUrl("https://f.test/family.css")).toBe(false);
      expect(isDirectFontUrl("https://f.test/css2?family=Inter")).toBe(false);
    });
  });

  describe("without a URL", () => {
    test("returns the sanitized family and loads nothing", async () => {
      const { fontFaceMock } = installFontFaceMock(jest.fn());

      await expect(loadMessageFont({ family: "My <Bad> Font!" })).resolves.toBe("My Bad Font");
      expect(fontFaceMock).not.toHaveBeenCalled();
    });

    test("returns null and reports a family that sanitizes to nothing", async () => {
      const { fontFaceMock } = installFontFaceMock(jest.fn());
      const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

      await expect(loadMessageFont({ family: "日本語", url: "https://fonts.test/jp.woff2" })).resolves.toBeNull();

      expect(fontFaceMock).not.toHaveBeenCalled();
      expect(publicErrorSpy).toHaveBeenCalledWith(expect.stringContaining("no usable character"));
    });
  });

  describe("direct font files", () => {
    test("adds and loads the FontFace on success", async () => {
      const load = jest.fn().mockResolvedValue(undefined);
      const { fontFaceMock, add } = installFontFaceMock(load);

      const url = "https://fonts.test/inter.woff2";
      await expect(loadMessageFont({ family: "Inter", url })).resolves.toBe("Inter");

      expect(fontFaceMock).toHaveBeenCalledWith("Inter", `url("${url}")`, { display: "swap" });
      expect(add).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledTimes(1);
    });

    test("does not reload the same family/url pair", async () => {
      const load = jest.fn().mockResolvedValue(undefined);
      installFontFaceMock(load);

      const url = "https://fonts.test/inter.woff2";
      await loadMessageFont({ family: "Inter", url });
      await loadMessageFont({ family: "Inter", url });

      expect(load).toHaveBeenCalledTimes(1);
    });

    test("loads the face under the very family the CSS variable will name", async () => {
      const load = jest.fn().mockResolvedValue(undefined);
      const { fontFaceMock } = installFontFaceMock(load);

      const family = await loadMessageFont({ family: "Noto Sans (Beta)", url: "https://fonts.test/exotic.woff2" });

      expect(fontFaceMock.mock.calls[0][0]).toBe(family);
      expect(family).toBe("Noto Sans Beta");
    });

    test("logs an error but resolves when the FontFace fails to load", async () => {
      const load = jest.fn().mockRejectedValue(new Error("network"));
      installFontFaceMock(load);
      const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(Log, "error").mockImplementation(() => undefined);

      const url = "https://fonts.test/broken.woff2";
      await expect(loadMessageFont({ family: "Inter", url })).resolves.toBe("Inter");

      expect(publicErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to load custom font"));
      expect(errorSpy).toHaveBeenCalledWith("Messaging", "Font load error:", expect.any(Error));
    });

    test("retries the load after a failure because the key is not memoized", async () => {
      const load = jest.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(undefined);
      installFontFaceMock(load);
      jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
      jest.spyOn(Log, "error").mockImplementation(() => undefined);

      const url = "https://fonts.test/retry.woff2";
      await loadMessageFont({ family: "Inter", url });
      await loadMessageFont({ family: "Inter", url });

      expect(load).toHaveBeenCalledTimes(2);
    });

    test("quotes and escapes the url, so a parenthesis in it cannot break the descriptor", async () => {
      const load = jest.fn().mockRejectedValue(new Error("404"));
      const { fontFaceMock } = installFontFaceMock(load);
      const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
      jest.spyOn(Log, "error").mockImplementation(() => undefined);

      await expect(loadMessageFont({ family: "Roboto", url: "https://x/a).woff" })).resolves.toBe("Roboto");

      expect(fontFaceMock).toHaveBeenCalledWith("Roboto", `url("https://x/a).woff")`, { display: "swap" });
      expect(publicErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to load custom font"));
    });

    test("escapes a quote and a backslash in the url", async () => {
      const load = jest.fn().mockResolvedValue(undefined);
      const { fontFaceMock } = installFontFaceMock(load);

      await loadMessageFont({ family: "Roboto", url: `https://x/a"b\\c.woff` });

      expect(fontFaceMock).toHaveBeenCalledWith("Roboto", `url("https://x/a\\"b\\\\c.woff")`, { display: "swap" });
    });
  });

  describe("unloadMessageFonts", () => {
    test("deletes every registered face and removes the stylesheet link", async () => {
      const load = jest.fn().mockResolvedValue(undefined);
      const { fontFaceMock, deleteFace } = installFontFaceMock(load);

      await loadMessageFont({ family: "Inter", url: "https://fonts.test/inter.woff2" });
      const stylesheet = loadMessageFont({ family: "Roboto", url: "https://fonts.test/family.css" });
      document.querySelector("link[data-batch-messaging-font]")?.dispatchEvent(new Event("load"));
      await stylesheet;

      unloadMessageFonts();

      expect(deleteFace).toHaveBeenCalledTimes(1);
      expect(deleteFace).toHaveBeenCalledWith(fontFaceMock.mock.results[0].value);
      expect(document.querySelector("link[data-batch-messaging-font]")).toBeNull();
    });

    test("lets the same direct font load again after an unload", async () => {
      const load = jest.fn().mockResolvedValue(undefined);
      installFontFaceMock(load);

      const url = "https://fonts.test/reset.woff2";
      await loadMessageFont({ family: "Inter", url });
      unloadMessageFonts();
      await loadMessageFont({ family: "Inter", url });

      expect(load).toHaveBeenCalledTimes(2);
    });
  });

  describe("stylesheet URLs", () => {
    test("injects a stylesheet link and resolves on load", async () => {
      const url = "https://fonts.test/family.css";
      const pending = loadMessageFont({ family: "Roboto", url });

      const link = document.querySelector<HTMLLinkElement>("link[data-batch-messaging-font]");
      if (!(link instanceof HTMLLinkElement)) {
        throw new Error("expected stylesheet link");
      }
      expect(link.rel).toBe("stylesheet");
      expect(link.href).toBe(url);

      link.dispatchEvent(new Event("load"));
      await expect(pending).resolves.toBe("Roboto");
    });

    test("skips re-injection when the same stylesheet URL is already active", async () => {
      const url = "https://fonts.test/shared.css";
      const first = loadMessageFont({ family: "Roboto", url });
      document.querySelector<HTMLLinkElement>("link[data-batch-messaging-font]")?.dispatchEvent(new Event("load"));
      await first;

      await loadMessageFont({ family: "Roboto Flex", url });

      expect(document.querySelectorAll("link[data-batch-messaging-font]")).toHaveLength(1);
    });

    test("removes the stale link when a different stylesheet URL is requested", async () => {
      const firstUrl = "https://fonts.test/first.css";
      const first = loadMessageFont({ family: "Roboto", url: firstUrl });
      const firstLink = document.querySelector<HTMLLinkElement>("link[data-batch-messaging-font]");
      firstLink?.dispatchEvent(new Event("load"));
      await first;

      const secondUrl = "https://fonts.test/second.css";
      const second = loadMessageFont({ family: "Roboto", url: secondUrl });
      const links = document.querySelectorAll<HTMLLinkElement>("link[data-batch-messaging-font]");
      expect(links).toHaveLength(1);
      expect(links[0]).not.toBe(firstLink);
      expect(links[0].href).toBe(secondUrl);

      links[0].dispatchEvent(new Event("load"));
      await second;
    });

    test("resolves immediately when the link stylesheet is already parsed", async () => {
      const createElementSpy = jest.spyOn(document, "createElement");
      createElementSpy.mockImplementation(function (this: Document, tagName: string, options?: ElementCreationOptions) {
        const element = Document.prototype.createElement.call(this, tagName, options);
        if (tagName === "link") {
          Object.defineProperty(element, "sheet", { configurable: true, value: {} });
        }
        return element;
      });

      await expect(loadMessageFont({ family: "Roboto", url: "https://fonts.test/parsed.css" })).resolves.toBe("Roboto");
    });

    test("warns and resolves without marking the URL active when the stylesheet errors", async () => {
      const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

      const url = "https://fonts.test/broken.css";
      const pending = loadMessageFont({ family: "Roboto", url });
      document.querySelector<HTMLLinkElement>("link[data-batch-messaging-font]")?.dispatchEvent(new Event("error"));
      await pending;

      expect(warnSpy).toHaveBeenCalledWith("Messaging", `Failed to load message font stylesheet: ${url}`);

      const retry = loadMessageFont({ family: "Roboto", url });
      document.querySelector<HTMLLinkElement>("link[data-batch-messaging-font]")?.dispatchEvent(new Event("load"));
      await retry;
      expect(document.querySelectorAll("link[data-batch-messaging-font]")).toHaveLength(1);
    });

    test("gives up after 5000ms when the stylesheet emits neither load nor error", async () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

      const url = "https://fonts.test/silent.css";
      const pending = loadMessageFont({ family: "Roboto", url });

      jest.advanceTimersByTime(4999);
      expect(warnSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      await expect(pending).resolves.toBe("Roboto");
      expect(warnSpy).toHaveBeenCalledWith("Messaging", `Message font stylesheet did not load within 5000ms: ${url}`);
    });
  });
});
