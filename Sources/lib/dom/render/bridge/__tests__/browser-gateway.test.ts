/* eslint-env jest */

import { MessageBrowserGateway, writeClipboardText } from "com.batch.dom/render/bridge/browser-gateway";
import { Log } from "com.batch.shared/logger";

describe("writeClipboardText", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      delete (navigator as unknown as { clipboard?: Clipboard }).clipboard;
    }
    jest.restoreAllMocks();
  });

  test("forwards to navigator.clipboard.writeText", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await writeClipboardText("PROMO2024");

    expect(writeText).toHaveBeenCalledWith("PROMO2024");
  });

  test("rejects when the Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    await expect(writeClipboardText("PROMO2024")).rejects.toThrow("Clipboard API unavailable");
  });

  test("rejects when the browser denies the write", async () => {
    const writeText = jest.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await expect(writeClipboardText("PROMO2024")).rejects.toThrow("Clipboard write denied");
  });

  test("falls back to a generic message when the rejection carries none", async () => {
    const writeText = jest.fn().mockRejectedValue("boom");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await expect(writeClipboardText("PROMO2024")).rejects.toThrow("Clipboard write denied");
  });
});

describe("MessageBrowserGateway", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("openExternalURL severs the opener of the new tab", () => {
    const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const opened = { opener: {} } as unknown as Window;
    jest.spyOn(window, "open").mockImplementation(() => opened);

    const gateway = new MessageBrowserGateway();
    gateway.openExternalURL("https://example.com", "_blank", "noopener");

    expect(opened.opener).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("openExternalURL tolerates a blocked or noopener-nulled window", () => {
    const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

    const gateway = new MessageBrowserGateway();
    gateway.openExternalURL("https://batch.com", "_blank", "noopener");

    expect(openSpy).toHaveBeenCalledWith("https://batch.com", "_blank", "noopener");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("openExternalURL keeps the opener of an in-page deeplink", () => {
    const current = { opener: {} } as unknown as Window;
    jest.spyOn(window, "open").mockImplementation(() => current);

    new MessageBrowserGateway().openExternalURL("https://example.com", "_self", "");

    expect(current.opener).not.toBeNull();
  });
});
