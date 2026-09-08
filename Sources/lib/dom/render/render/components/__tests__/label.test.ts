/* eslint-env jest */

import type { MessageLabelModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageLabelPayload } from "com.batch.dom/render/model/types";
import { renderLabel } from "com.batch.dom/render/render/components/label";
import { componentMessage, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";

const DEFAULT_TEXTS = { title: "Hello World" };

function renderLabelFrom(patch: Partial<MessageLabelPayload> = {}, texts: Record<string, string> = DEFAULT_TEXTS): HTMLElement {
  const message = normalizeMessage(componentMessage({ type: "text", id: "title", ...patch }, { texts }));
  return renderLabel(selectFirstChild<MessageLabelModel>(message, "text"), message);
}

describe("renderLabel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("has className iam-text", () => {
    const el = renderLabelFrom();
    expect(el.className).toBe("iam-text");
  });

  test("renders text content from message.texts via contentRef", () => {
    const el = renderLabelFrom({}, { title: "Hello World" });
    expect(el.textContent).toBe("Hello World");
  });

  test("falls back to empty string when contentRef is missing from texts", () => {
    const el = renderLabelFrom({ id: "missing" }, { title: "Hello" });
    expect(el.textContent).toBe("");
  });

  test("drives fontSize through the responsive CSS var pair", () => {
    const el = renderLabelFrom({ fontSize: 20 });
    expect(el.style.fontSize).toBe("");
    expect(el.style.getPropertyValue("--iam-font-size")).toBe("20px");
    expect(el.style.getPropertyValue("--iam-font-size-desktop")).toBe("20px");
  });

  test("stamps the desktop fontSize when provided", () => {
    const el = renderLabelFrom({ fontSize: 20, fontSizeDesktop: 28 });
    expect(el.style.getPropertyValue("--iam-font-size")).toBe("20px");
    expect(el.style.getPropertyValue("--iam-font-size-desktop")).toBe("28px");
  });

  test("sets lineHeight to 1.4", () => {
    const el = renderLabelFrom();
    expect(el.style.lineHeight).toBe("1.4");
  });

  test("sets minWidth to zero to avoid overflow in flex layouts", () => {
    const el = renderLabelFrom();
    expect(el.style.minWidth).toMatch(/^0(px)?$/);
  });

  test("writes color theme pair CSS custom properties", () => {
    const el = renderLabelFrom({ color: ["#FF0000FF", "#0000FFFF"] });
    expect(el.style.getPropertyValue("--iam-color")).toBe("rgba(255,0,0,1.000)");
    expect(el.style.getPropertyValue("--iam-color-dark")).toBe("rgba(0,0,255,1.000)");
  });

  test("uses single color for both light and dark when only one color provided", () => {
    const el = renderLabelFrom({ color: ["#ABCDEFFF"] });
    expect(el.style.getPropertyValue("--iam-color")).toBe("rgba(171,205,239,1.000)");
    expect(el.style.getPropertyValue("--iam-color-dark")).toBe("rgba(171,205,239,1.000)");
  });

  test("applies textAlign from style.align", () => {
    expect(renderLabelFrom({ textAlign: "left" }).style.textAlign).toBe("left");
    expect(renderLabelFrom({ textAlign: "center" }).style.textAlign).toBe("center");
    expect(renderLabelFrom({ textAlign: "right" }).style.textAlign).toBe("right");
  });

  test("maxLines 0 disables truncation", () => {
    const el = renderLabelFrom({ maxLines: 0 });
    expect(el.style.overflow).toBe("visible");
    expect(el.style.textOverflow).toBe("clip");
    expect(el.style.whiteSpace).toBe("normal");
  });

  test("maxLines 1 applies single-line truncation", () => {
    const el = renderLabelFrom({ maxLines: 1 });
    expect(el.style.overflow).toBe("hidden");
    expect(el.style.textOverflow).toBe("ellipsis");
    expect(el.style.whiteSpace).toBe("nowrap");
  });

  test("maxLines 3 applies webkit multi-line clamp", () => {
    const el = renderLabelFrom({ maxLines: 3 });
    expect(el.style.overflow).toBe("hidden");
    expect(el.style.display).toBe("-webkit-box");
    expect(el.style.webkitLineClamp).toBe("3");
  });

  test("bold decoration sets fontWeight 700", () => {
    const el = renderLabelFrom({ fontDecoration: ["bold"] });
    expect(el.style.fontWeight).toBe("700");
  });

  test("italic decoration sets fontStyle italic", () => {
    const el = renderLabelFrom({ fontDecoration: ["italic"] });
    expect(el.style.fontStyle).toBe("italic");
  });

  test("underline decoration sets textDecoration", () => {
    const el = renderLabelFrom({ fontDecoration: ["underline"] });
    expect(el.style.textDecoration).toContain("underline");
  });

  test("stroke decoration sets line-through", () => {
    const el = renderLabelFrom({ fontDecoration: ["stroke"] });
    expect(el.style.textDecoration).toContain("line-through");
  });

  test("no decoration sets fontWeight 400 and no text-decoration", () => {
    const el = renderLabelFrom({ fontDecoration: [] });
    expect(el.style.fontWeight).toBe("400");
    expect(el.style.textDecoration).toBe("none");
  });

  test("drives margin through the responsive CSS var pair", () => {
    const el = renderLabelFrom({ margin: [8, 16, 4, 12] });
    expect(el.style.margin).toBe("");
    expect(el.style.getPropertyValue("--iam-margin")).toBe("8px 16px 4px 12px");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("8px 16px 4px 12px");
  });

  test("stamps the desktop margin when provided", () => {
    const el = renderLabelFrom({ margin: [8, 16, 4, 12], marginDesktop: [16, 32, 8, 24] });
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("16px 32px 8px 24px");
  });
});
