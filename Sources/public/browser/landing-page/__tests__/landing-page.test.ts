/* eslint-env jest */

import { Log } from "com.batch.shared/logger";

import { WS_URL } from "../../../../config";
import { autoInitLandingPage, bootstrapLandingPage, resolveLandingPageMarker } from "../landing-page";

function makeMarker(overrides: { type?: string; endpoint?: string; content?: string } = {}): HTMLScriptElement {
  const marker = document.createElement("script");
  marker.type = overrides.type ?? "application/json";
  marker.dataset.batchLp = "";
  if (overrides.endpoint !== "") {
    marker.dataset.inputEndpoint = overrides.endpoint ?? `${WS_URL}/lp/input`;
  }
  marker.textContent = overrides.content ?? JSON.stringify({ payload: { root: { children: [] } } });
  return marker;
}

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, "readyState", { configurable: true, get: () => state });
}

describe("resolveLandingPageMarker", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  test("returns the JSON definition element flagged with data-batch-lp", () => {
    const marker = makeMarker();
    document.body.appendChild(marker);

    expect(resolveLandingPageMarker()).toBe(marker);
  });

  test("ignores a data-batch-lp element that is not a JSON script", () => {
    const marker = makeMarker({ type: "text/javascript", content: "/* not json */" });
    document.body.appendChild(marker);

    expect(resolveLandingPageMarker()).toBeNull();
  });

  test("returns null when no element opted into auto-init", () => {
    const plain = document.createElement("script");
    plain.type = "application/json";
    document.body.appendChild(plain);

    expect(resolveLandingPageMarker()).toBeNull();
  });
});

describe("autoInitLandingPage", () => {
  const realReadyState = Object.getOwnPropertyDescriptor(Document.prototype, "readyState");

  afterEach(() => {
    if (realReadyState) {
      Object.defineProperty(document, "readyState", realReadyState);
    }
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("reports a public error when the page carries no marker", () => {
    setReadyState("complete");
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

    autoInitLandingPage();

    expect(publicError).toHaveBeenCalledWith(expect.stringContaining("no data-batch-lp definition marker"));
    expect(document.querySelectorAll(".batch-lp-surface").length).toBe(0);
  });

  test("boots immediately when the document is already parsed", () => {
    setReadyState("complete");
    const marker = makeMarker();
    document.body.appendChild(marker);

    autoInitLandingPage();

    expect(marker.dataset.batchLpState).toBe("booting");
  });

  test("defers the boot to DOMContentLoaded while the document is parsing", () => {
    setReadyState("loading");
    const marker = makeMarker();
    document.body.appendChild(marker);

    autoInitLandingPage();
    expect(marker.dataset.batchLpState).toBeUndefined();

    setReadyState("interactive");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(marker.dataset.batchLpState).toBe("booting");
  });

  test("a second auto-init does not boot the same marker twice", () => {
    setReadyState("complete");
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
    const marker = makeMarker();
    document.body.appendChild(marker);

    autoInitLandingPage();
    const stateAfterFirst = marker.dataset.batchLpState;
    autoInitLandingPage();

    expect(stateAfterFirst).toBe("booting");
    expect(marker.dataset.batchLpState).toBe("booting");
    expect(publicError).toHaveBeenCalledWith(expect.stringContaining("already initialized"));
    expect(document.querySelectorAll(".batch-lp-surface").length).toBeLessThanOrEqual(1);
  });
});

describe("bootstrapLandingPage error boundaries", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("aborts with a public error when data-input-endpoint is missing", async () => {
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

    const mount = document.createElement("div");
    mount.id = "batch-lp-root";
    document.body.appendChild(mount);

    const marker = makeMarker({ endpoint: "" });
    marker.dataset.mount = "#batch-lp-root";
    document.body.appendChild(marker);

    await bootstrapLandingPage(marker);

    expect(publicError).toHaveBeenCalledWith(expect.stringContaining("data-input-endpoint"));
    expect(document.querySelector("#batch-lp-root .batch-lp-surface")).toBeNull();
  });
});
