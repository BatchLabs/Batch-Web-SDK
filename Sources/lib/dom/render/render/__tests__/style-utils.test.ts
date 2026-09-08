/* eslint-env jest */

import { applyFillImage, resolveAlignSelf, resolveFlexWeight } from "com.batch.dom/render/render/style-utils";

describe("resolveAlignSelf", () => {
  test("maps left to flex-start", () => {
    expect(resolveAlignSelf("left")).toBe("flex-start");
  });

  test("maps center to center", () => {
    expect(resolveAlignSelf("center")).toBe("center");
  });

  test("maps right to flex-end", () => {
    expect(resolveAlignSelf("right")).toBe("flex-end");
  });
});

describe("applyFillImage", () => {
  test("applies full-size block image styles", () => {
    const img = document.createElement("img");
    applyFillImage(img);

    expect(img.style.width).toBe("100%");
    expect(img.style.height).toBe("100%");
    expect(img.style.display).toBe("block");
  });
});

describe("resolveFlexWeight", () => {
  test("returns a flex shorthand starting with the weight", () => {
    expect(resolveFlexWeight(0.75)).toMatch(/^0\.75/);
  });
});
