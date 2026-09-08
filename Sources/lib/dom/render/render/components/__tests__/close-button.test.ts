/* eslint-env jest */

import { renderCloseButton } from "com.batch.dom/render/render/components/close-button";
import type { CloseButtonOptions } from "com.batch.dom/render/render/components/close-button";

function makeOpts(overrides?: Partial<CloseButtonOptions>): CloseButtonOptions {
  return {
    onClose: jest.fn(),
    ...overrides,
  };
}

describe("renderCloseButton", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("creates a button element with className iam-close", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toBe("iam-close");
  });

  test("has default aria-label Close", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.getAttribute("aria-label")).toBe("Close");
  });

  test("accepts custom aria-label", () => {
    const btn = renderCloseButton(makeOpts({ ariaLabel: "Fermer" }));
    expect(btn.getAttribute("aria-label")).toBe("Fermer");
  });

  test("contains an SVG with correct viewBox", () => {
    const btn = renderCloseButton(makeOpts());
    const svg = btn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 9 9");
  });

  test("SVG is aria-hidden", () => {
    const btn = renderCloseButton(makeOpts());
    const svg = btn.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  test("SVG path uses evenodd fill-rule", () => {
    const btn = renderCloseButton(makeOpts());
    const path = btn.querySelector("path");
    expect(path?.getAttribute("fill-rule")).toBe("evenodd");
    expect(path?.getAttribute("fill")).toBe("currentColor");
  });

  test("button is positioned in the top-right corner by default", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.style.position).toBe("absolute");
    expect(btn.style.top).toMatch(/px$/);
    expect(btn.style.right).toMatch(/px$/);
    expect(Number.parseFloat(btn.style.top)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(btn.style.right)).toBeGreaterThanOrEqual(0);
  });

  test("uses an explicit square hit area with matching minimum dimensions", () => {
    const btn = renderCloseButton(makeOpts());
    const width = Number.parseFloat(btn.style.width);
    const height = Number.parseFloat(btn.style.height);
    const minWidth = Number.parseFloat(btn.style.minWidth);
    const minHeight = Number.parseFloat(btn.style.minHeight);

    expect(width).toBeGreaterThan(0);
    expect(height).toBe(width);
    expect(minWidth).toBe(width);
    expect(minHeight).toBe(height);
  });

  test("has circular border radius", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.style.borderRadius).toBe("999px");
  });

  test("is a flex container for icon centering", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.style.display).toBe("flex");
    expect(btn.style.alignItems).toBe("center");
    expect(btn.style.justifyContent).toBe("center");
  });

  test("calls onClose when clicked", () => {
    const onClose = jest.fn();
    const btn = renderCloseButton(makeOpts({ onClose }));
    btn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("writes theme pair when opts.color is provided", () => {
    const btn = renderCloseButton(makeOpts({ opts: { color: ["#FF0000FF", "#0000FFFF"] } }));
    expect(btn.style.getPropertyValue("--iam-close-color")).toBe("rgba(255,0,0,1.000)");
    expect(btn.style.getPropertyValue("--iam-close-color-dark")).toBe("rgba(0,0,255,1.000)");
  });

  test("writes background theme pair when opts.backgroundColor is provided", () => {
    const btn = renderCloseButton(makeOpts({ opts: { color: ["#000000FF"], backgroundColor: ["#FFFFFFCC"] } }));
    expect(btn.style.getPropertyValue("--iam-close-bg")).toBe("rgba(255,255,255,0.800)");
  });

  test("has z-index 1", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.style.zIndex).toBe("1");
  });

  test("cursor is pointer", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.style.cursor).toBe("pointer");
  });

  test("leaves background to the stylesheet instead of an inline style", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.style.backgroundColor).toBe("");
    expect(btn.style.getPropertyValue("background-color")).toBe("");
    expect(btn.className).toBe("iam-close");
  });

  test("uses default color token when opts are omitted", () => {
    const btn = renderCloseButton(makeOpts());
    expect(btn.style.getPropertyValue("--iam-close-color")).toBe("");
    expect(btn.style.getPropertyValue("--iam-close-bg")).toBe("");
  });
});
