/* eslint-env jest */

import { renderSurfaceProgressBar } from "com.batch.dom/render/render/components/progress-bar";
import type { SurfaceProgressBarOptions } from "com.batch.dom/render/render/components/progress-bar";

describe("renderSurfaceProgressBar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  function makeOpts(overrides?: Partial<SurfaceProgressBarOptions>): SurfaceProgressBarOptions {
    return {
      totalDelay: 10,
      elapsed: 0,
      color: undefined,
      ...overrides,
    };
  }

  test("has className iam-progress", () => {
    const bar = renderSurfaceProgressBar(makeOpts());
    expect(bar.className).toBe("iam-progress");
  });

  test("is anchored to the top-left edge and spans the full width", () => {
    const bar = renderSurfaceProgressBar(makeOpts());
    expect(bar.style.position).toBe("absolute");
    expect(bar.style.top).toBe("0px");
    expect(bar.style.left).toBe("0px");
    expect(bar.style.width).toBe("100%");
    expect(Number.parseFloat(bar.style.height)).toBeGreaterThan(0);
  });

  test("animation targets iam-progress-countdown keyframe", () => {
    const bar = renderSurfaceProgressBar(makeOpts());
    expect(bar.style.animationName).toBe("iam-progress-countdown");
    expect(bar.style.animationTimingFunction).toBe("linear");
    expect(bar.style.animationFillMode).toBe("forwards");
  });

  test("animationDuration is derived from totalDelay in seconds", () => {
    const bar = renderSurfaceProgressBar(makeOpts({ totalDelay: 7 }));
    expect(bar.style.animationDuration).toBe("7s");
  });

  test("animationDelay is negative elapsed to seek position", () => {
    const bar = renderSurfaceProgressBar(makeOpts({ totalDelay: 10, elapsed: 3 }));
    expect(bar.style.animationDelay).toBe("-3s");
  });

  test("transform starts at scaleX(1) with left-center origin", () => {
    const bar = renderSurfaceProgressBar(makeOpts());
    expect(bar.style.transform).toBe("scaleX(1)");
    expect(bar.style.transformOrigin).toBe("left center");
  });

  test("marks transform as a changing property", () => {
    const bar = renderSurfaceProgressBar(makeOpts());
    expect(bar.style.willChange).toBe("transform");
  });

  test("defines stacking and rounded corners", () => {
    const bar = renderSurfaceProgressBar(makeOpts());
    expect(bar.style.zIndex).toBe("2");
    expect(Number.parseFloat(bar.style.borderRadius)).toBeGreaterThanOrEqual(0);
  });

  test("writes theme pair when color is provided", () => {
    const bar = renderSurfaceProgressBar(makeOpts({ color: ["#FF0000FF"] }));
    expect(bar.style.getPropertyValue("--iam-progress-color")).toBe("rgba(255,0,0,1.000)");
    expect(bar.style.getPropertyValue("--iam-progress-color-dark")).toBe("rgba(255,0,0,1.000)");
  });

  test("does not write theme pair when color is undefined", () => {
    const bar = renderSurfaceProgressBar(makeOpts({ color: undefined }));
    expect(bar.style.getPropertyValue("--iam-progress-color")).toBe("");
  });
});
