/* eslint-env jest */

jest.mock("com.batch.dom/render/landing-page/input-transport", () => ({
  createLandingInputTransport: jest.fn(() => ({ submitFields: jest.fn(), emitEvent: jest.fn() })),
}));
jest.mock("com.batch.dom/render/landing-page/preview-transport", () => ({
  createLandingPreviewTransport: jest.fn(() => ({ submitFields: jest.fn(), emitEvent: jest.fn() })),
}));

import { createLandingInputTransport } from "com.batch.dom/render/landing-page/input-transport";
import { createLandingPreviewTransport } from "com.batch.dom/render/landing-page/preview-transport";

import { WS_URL } from "../../../../config";
import { bootstrapLandingPage } from "../landing-page";

function makeMarker(previewAttribute?: string): HTMLScriptElement {
  const marker = document.createElement("script");
  marker.type = "application/json";
  marker.dataset.batchLp = "";
  marker.dataset.inputEndpoint = `${WS_URL}/lp/input`;
  if (previewAttribute !== undefined) {
    marker.setAttribute("data-submit-mode-preview", previewAttribute);
  }
  marker.textContent = JSON.stringify({ payload: { root: { children: [] } } });
  return marker;
}

describe("bootstrapLandingPage transport selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("a bare data-submit-mode-preview builds the preview transport", async () => {
    await bootstrapLandingPage(makeMarker(""));

    expect(createLandingPreviewTransport).toHaveBeenCalledWith({ inputEndpoint: `${WS_URL}/lp/input`, eventData: {} });
    expect(createLandingPreviewTransport).toHaveBeenCalledTimes(1);
    expect(createLandingInputTransport).not.toHaveBeenCalled();
  });

  test.each([
    ["a redundant value", "preview"],
    ["a contradictory value", "false"],
  ])("%s on the attribute changes nothing: presence decides", async (_label, value) => {
    await bootstrapLandingPage(makeMarker(value));

    expect(createLandingPreviewTransport).toHaveBeenCalledTimes(1);
    expect(createLandingInputTransport).not.toHaveBeenCalled();
  });

  test("without the attribute the real input transport is built", async () => {
    await bootstrapLandingPage(makeMarker());

    expect(createLandingInputTransport).toHaveBeenCalledTimes(1);
    expect(createLandingPreviewTransport).not.toHaveBeenCalled();
  });

  test.each([
    ["data-submit-mode", "preview"],
    ["data-batch-lp-preview", ""],
    ["data-preview", ""],
  ])("a %s attribute is not honoured", async (attribute, value) => {
    const marker = makeMarker();
    marker.setAttribute(attribute, value);

    await bootstrapLandingPage(marker);

    expect(createLandingInputTransport).toHaveBeenCalledTimes(1);
    expect(createLandingPreviewTransport).not.toHaveBeenCalled();
  });
});
