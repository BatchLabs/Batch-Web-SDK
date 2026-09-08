describe("logger", () => {
  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
  });

  test("emits a window event for visible log entries", () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const entries: Array<{
      level: number;
      levelName: string;
      module: string;
      prefix: string;
      args: unknown[];
      timestamp: number;
    }> = [];

    const listener = (event: Event): void => {
      entries.push((event as CustomEvent).detail);
    };

    window.addEventListener("___batchSDK___.logger.entry", listener);

    jest.isolateModules(() => {
      const { Log, LogLevel } = require("../lib/shared/logger");
      Log.level = LogLevel.Debug;
      Log.enableModule("*");
      Log.warn("Message", "Bridge event:", "openDeeplink", { l: "https://batch.com" });
    });

    window.removeEventListener("___batchSDK___.logger.entry", listener);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 4,
      levelName: "Warn",
      module: "Message",
      prefix: "Batch SDK [Message]",
      args: ["Bridge event:", "openDeeplink", "[[object Object]]"],
    });
    expect(typeof entries[0].timestamp).toBe("number");
    consoleWarnSpy.mockRestore();
  });

  test("does not emit an event for filtered-out log entries", () => {
    const listener = jest.fn();
    window.addEventListener("___batchSDK___.logger.entry", listener);

    jest.isolateModules(() => {
      const { Log, LogLevel } = require("../lib/shared/logger");
      Log.level = LogLevel.PublicError;
      Log.warn("Message", "Hidden warning");
    });

    window.removeEventListener("___batchSDK___.logger.entry", listener);

    expect(listener).not.toHaveBeenCalled();
  });

  test("can be driven through the window logger write event", () => {
    const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    window.localStorage.setItem("com.batch.private.logger.listeners", "1");
    window.localStorage.setItem("com.batch.private.logger.level", "7");
    window.localStorage.setItem("com.batch.private.logger.modules.enabled", JSON.stringify(["*"]));

    const entries: Array<{ module: string; args: unknown[]; levelName: string }> = [];
    const listener = (event: Event): void => {
      entries.push((event as CustomEvent).detail);
    };

    window.addEventListener("___batchSDK___.logger.entry", listener);

    jest.isolateModules(() => {
      // oxlint-disable-next-line import/no-unassigned-import -- re-evaluates the module for its side effects
      require("../lib/shared/logger");
      window.dispatchEvent(
        new CustomEvent("___batchSDK___.logger.write", {
          detail: {
            level: "info",
            module: "DemoMessage",
            args: ["Rendered message: https://batch.com"],
          },
        })
      );
    });

    window.removeEventListener("___batchSDK___.logger.entry", listener);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      module: "DemoMessage",
      levelName: "Info",
      args: ["Rendered message: https://batch.com"],
    });
    consoleInfoSpy.mockRestore();
  });

  test("warns when localStorage logger module lists are invalid JSON", () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    window.localStorage.setItem("com.batch.private.logger.modules.enabled", "{");

    jest.isolateModules(() => {
      // oxlint-disable-next-line import/no-unassigned-import -- re-evaluates the module for its side effects
      require("../lib/shared/logger");
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Batch SDK: failed to parse logger module settings from localStorage:",
      expect.any(SyntaxError)
    );
  });
});
