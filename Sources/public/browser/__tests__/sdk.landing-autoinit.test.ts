/* eslint-env jest */

import { BatchWindow } from "../ui/sdk";

describe("sdk entry — queue drain", () => {
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

  function loadSdkEntry(api: object = {}): void {
    jest.isolateModules(() => {
      jest.doMock("../public-api", () => ({ __esModule: true, default: () => api }));
      require("../sdk");
    });
  }

  test("drains the queued setup exactly once", () => {
    const setup = jest.fn();
    const queue: unknown[][] = [["setup", { apiKey: "a", authKey: "b" }]];
    (sdkWindow as unknown as { batchSDK: unknown }).batchSDK = Object.assign((...args: unknown[]) => queue.push(args), { q: queue });

    loadSdkEntry({ setup });

    expect(setup).toHaveBeenCalledWith({ apiKey: "a", authKey: "b" });
    expect(setup).toHaveBeenCalledTimes(1);
  });
});

describe("sdk entry — landing auto-detection", () => {
  const sdkWindow = window as unknown as BatchWindow;
  const originalBatchSDK = sdkWindow.batchSDK;

  afterEach(() => {
    document.querySelectorAll("script").forEach(tag => tag.remove());
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();

    if (originalBatchSDK) {
      sdkWindow.batchSDK = originalBatchSDK;
    } else {
      delete (sdkWindow as Partial<BatchWindow>).batchSDK;
    }
  });

  function loadSdkEntry(newPublicAPI: jest.Mock = jest.fn(() => ({}))): void {
    jest.isolateModules(() => {
      jest.doMock("../public-api", () => ({ __esModule: true, default: newPublicAPI }));
      require("../sdk");
    });
  }

  function addMarker(): HTMLScriptElement {
    const marker = document.createElement("script");
    marker.type = "application/json";
    marker.dataset.batchLp = "";
    marker.textContent = '{"payload":{}}';
    document.body.appendChild(marker);
    return marker;
  }

  function landingScriptTags(): HTMLScriptElement[] {
    return Array.from(document.querySelectorAll<HTMLScriptElement>("script[src*='landing-page.min.js']"));
  }

  test("marker present: injects the landing bundle and still boots normally", () => {
    addMarker();
    const setup = jest.fn();
    const newPublicAPI = jest.fn(() => ({ setup }));
    const queue: unknown[][] = [["setup", { apiKey: "a", authKey: "b" }]];
    (sdkWindow as unknown as { batchSDK: unknown }).batchSDK = Object.assign((...args: unknown[]) => queue.push(args), { q: queue });

    loadSdkEntry(newPublicAPI);

    const tags = landingScriptTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].src).toContain("/landing-page.min.js");
    expect(tags[0].async).toBe(true);
    expect(newPublicAPI).toHaveBeenCalledTimes(1);
    expect(setup).toHaveBeenCalledWith({ apiKey: "a", authKey: "b" });
  });

  test("no marker: nothing is injected, regular boot only", () => {
    const newPublicAPI = jest.fn(() => ({}));

    loadSdkEntry(newPublicAPI);

    expect(landingScriptTags()).toHaveLength(0);
    expect(newPublicAPI).toHaveBeenCalledTimes(1);
  });

  test("document still parsing, marker not reached: the detection retries at DOMContentLoaded", () => {
    const readyState = jest.spyOn(document, "readyState", "get").mockReturnValue("loading");

    loadSdkEntry();
    expect(landingScriptTags()).toHaveLength(0);

    addMarker();
    readyState.mockRestore();
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(landingScriptTags()).toHaveLength(1);
  });

  test("document still parsing, marker already reached: injects immediately, once", () => {
    addMarker();
    const readyState = jest.spyOn(document, "readyState", "get").mockReturnValue("loading");

    loadSdkEntry();

    expect(landingScriptTags()).toHaveLength(1);

    readyState.mockRestore();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(landingScriptTags()).toHaveLength(1);
  });

  test("double sdk boot: the marker is claimed once, single injection", () => {
    addMarker();

    loadSdkEntry();
    loadSdkEntry();

    expect(landingScriptTags()).toHaveLength(1);
  });

  test("landing bundle already on the page: no extra injection", () => {
    addMarker();
    const direct = document.createElement("script");
    direct.src = "https://via.batch.com/landing-page.min.js";
    document.head.appendChild(direct);

    loadSdkEntry();

    expect(landingScriptTags()).toHaveLength(1);
  });
});

describe("landing-page entry — served-page auto-init", () => {
  const globalWithFetch = global as unknown as { fetch?: typeof fetch };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete globalWithFetch.fetch;
  });

  function loadLandingEntry(autoInit: jest.Mock): void {
    globalWithFetch.fetch = jest.fn();

    jest.isolateModules(() => {
      jest.doMock("../landing-page/landing-page", () => ({ __esModule: true, autoInitLandingPage: autoInit }));
      require("../landing-page/landing-page-bootstrap");
    });
  }

  test("calls the landing auto-init exactly once", () => {
    const autoInit = jest.fn();
    loadLandingEntry(autoInit);
    expect(autoInit).toHaveBeenCalledTimes(1);
  });

  test("a throwing auto-init does not throw out of the bundle entry", () => {
    const autoInit = jest.fn(() => {
      throw new Error("landing exploded");
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => loadLandingEntry(autoInit)).not.toThrow();
    expect(autoInit).toHaveBeenCalledTimes(1);
  });
});
