/* eslint-env jest */

import type * as LoggerModule from "com.batch.shared/logger";

import { BatchWindow } from "../ui/sdk";

describe("public sdk short syntax", () => {
  const sdkWindow = window as unknown as BatchWindow;
  const originalBatchSDK = sdkWindow.batchSDK;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    if (originalBatchSDK) {
      sdkWindow.batchSDK = originalBatchSDK;
    } else {
      delete (sdkWindow as Partial<BatchWindow>).batchSDK;
    }
  });

  test("resolves top-level methods", () => {
    const trackEvent = jest.fn();

    jest.isolateModules(() => {
      jest.doMock("../public-api", () => ({
        __esModule: true,
        default: () => ({
          trackEvent,
        }),
      }));

      require("../sdk");
    });

    sdkWindow.batchSDK("trackEvent", "custom_event");

    expect(trackEvent).toHaveBeenCalledWith("custom_event");
  });

  test("resolves a path deeper than one namespace", () => {
    const display = jest.fn();

    jest.isolateModules(() => {
      jest.doMock("../public-api", () => ({
        __esModule: true,
        default: () => ({
          __demo: { messaging: { display } },
        }),
      }));

      require("../sdk");
    });

    const envelope = { payload: { format: "fullscreen" } };
    sdkWindow.batchSDK("__demo.messaging.display", envelope);

    expect(display).toHaveBeenCalledWith(envelope);
  });

  test("invokes a nested method with its owner object as `this`", () => {
    const open = jest.fn();
    const ui = { open };

    jest.isolateModules(() => {
      jest.doMock("../public-api", () => ({
        __esModule: true,
        default: () => ({ ui }),
      }));

      require("../sdk");
    });

    sdkWindow.batchSDK("ui.open");

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.contexts[0]).toBe(ui);
  });

  test.each(["__proto__.toString", "constructor.assign", "nope.nope"])("refuses the path %s", path => {
    const trackEvent = jest.fn();
    const open = jest.fn();
    let warn: jest.SpyInstance | undefined;

    jest.isolateModules(() => {
      jest.doMock("com.batch.shared/logger", () => {
        const actual = jest.requireActual<typeof LoggerModule>("com.batch.shared/logger");
        warn = jest.spyOn(actual.Log, "warn").mockImplementation(() => undefined);
        return actual;
      });
      jest.doMock("../public-api", () => ({
        __esModule: true,
        default: () => ({ trackEvent, ui: { open } }),
      }));

      require("../sdk");
    });

    sdkWindow.batchSDK(path);

    expect(warn).toHaveBeenCalledWith(expect.any(String), "Unknown message", path);
    expect(trackEvent).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
