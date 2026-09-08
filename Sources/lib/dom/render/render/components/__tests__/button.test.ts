/* eslint-env jest */

import type { MessageButtonModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageButtonPayload } from "com.batch.dom/render/model/types";
import { renderButton } from "com.batch.dom/render/render/components/button";
import { componentMessage, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";

const DEFAULT_TEXTS = { cta: "A very long call to action" };

function renderButtonFrom(
  patch: Partial<MessageButtonPayload> = {},
  texts: Record<string, string> = DEFAULT_TEXTS,
  onAction: (componentId: string) => void = jest.fn()
): HTMLButtonElement {
  const message = normalizeMessage(
    componentMessage(
      {
        type: "button",
        id: "cta",
        backgroundColor: ["#FFFFFFFF"],
        borderColor: ["#00000000"],
        textColor: ["#000000FF"],
        fontSize: 14,
        ...patch,
      },
      { texts }
    )
  );
  return renderButton(selectFirstChild<MessageButtonModel>(message, "button"), message, onAction);
}

describe("renderButton", () => {
  test("binds the click to the action ref, and binds nothing without one", () => {
    const bound = jest.fn();
    renderButtonFrom({ id: "cta" }, DEFAULT_TEXTS, bound).click();
    expect(bound).toHaveBeenCalledWith("cta");

    const inert = jest.fn();
    renderButtonFrom({ id: "" }, DEFAULT_TEXTS, inert).click();
    expect(inert).not.toHaveBeenCalled();
  });

  test("applies single-line tail truncation to the label when maxLines is 1", () => {
    const button = renderButtonFrom({ maxLines: 1 });
    const label = button.querySelector(".iam-button-label") as HTMLSpanElement | null;

    expect(label).not.toBeNull();
    expect(label?.style.whiteSpace).toBe("nowrap");
    expect(label?.style.textOverflow).toBe("ellipsis");
    expect(label?.style.overflow).toBe("hidden");
  });

  test("keeps multiline text allowed when maxLines is 0", () => {
    const button = renderButtonFrom({ maxLines: 0 });
    const label = button.querySelector(".iam-button-label") as HTMLSpanElement | null;

    expect(label).not.toBeNull();
    expect(label?.style.whiteSpace).toBe("normal");
    expect(label?.style.textOverflow).toBe("clip");
    expect(label?.style.overflow).toBe("visible");
  });

  test("writes theme source custom properties on the button element", () => {
    const button = renderButtonFrom({ maxLines: 1 });

    expect(button.style.getPropertyValue("--iam-bg")).toBe("rgba(255,255,255,1.000)");
    expect(button.style.getPropertyValue("--iam-bg-dark")).toBe("rgba(255,255,255,1.000)");
    expect(button.style.getPropertyValue("--iam-color")).toBe("rgba(0,0,0,1.000)");
    expect(button.style.getPropertyValue("--iam-color-dark")).toBe("rgba(0,0,0,1.000)");
    expect(button.style.getPropertyValue("--iam-border-color")).toBe("rgba(0,0,0,0.000)");
    expect(button.style.getPropertyValue("--iam-border-color-dark")).toBe("rgba(0,0,0,0.000)");
  });

  test("drives font size through the responsive CSS var pair on the label", () => {
    const button = renderButtonFrom({ fontSize: 16 });
    const label = button.querySelector(".iam-button-label") as HTMLSpanElement;

    expect(label.style.fontSize).toBe("");
    expect(label.style.getPropertyValue("--iam-font-size")).toBe("16px");
    expect(label.style.getPropertyValue("--iam-font-size-desktop")).toBe("16px");
  });

  test("stamps the desktop font size when provided", () => {
    const label = renderButtonFrom({ fontSize: 16, fontSizeDesktop: 20 }).querySelector(".iam-button-label") as HTMLSpanElement;

    expect(label.style.getPropertyValue("--iam-font-size")).toBe("16px");
    expect(label.style.getPropertyValue("--iam-font-size-desktop")).toBe("20px");
  });

  test("applies radius to the button element", () => {
    const button = renderButtonFrom({ radius: [8, 8, 8, 8] });
    expect(button.style.borderRadius).toBe("8px 8px 8px 8px");
  });

  test("applies non-zero border width in pixels", () => {
    const button = renderButtonFrom({ borderWidth: 2 });
    expect(button.style.borderWidth).toBe("2px");
  });

  test("keeps zero border width explicit", () => {
    const button = renderButtonFrom({ borderWidth: 0 });
    expect(button.style.borderWidth).toBe("0px");
  });

  test("maps style alignments to textAlign", () => {
    expect(renderButtonFrom({ textAlign: "left" }).style.textAlign).toBe("left");
    expect(renderButtonFrom({ textAlign: "center" }).style.textAlign).toBe("center");
    expect(renderButtonFrom({ textAlign: "right" }).style.textAlign).toBe("right");
  });

  test("maps placement left alignment to flex-start", () => {
    expect(renderButtonFrom({ align: "left", width: "50%" }).style.alignSelf).toBe("flex-start");
  });

  test("maps placement center alignment to center", () => {
    expect(renderButtonFrom({ align: "center", width: "50%" }).style.alignSelf).toBe("center");
  });

  test("maps placement right alignment to flex-end", () => {
    expect(renderButtonFrom({ align: "right", width: "50%" }).style.alignSelf).toBe("flex-end");
  });

  test("stretches a fill width inside the margin box instead of forcing width 100%", () => {
    const button = renderButtonFrom({ width: "fill" });
    expect(button.style.width).toBe("");
    expect(button.style.alignSelf).toBe("stretch");
  });

  test("stretches the default 100 percent width and ignores align", () => {
    const button = renderButtonFrom({ align: "left" });
    expect(button.style.width).toBe("");
    expect(button.style.alignSelf).toBe("stretch");
  });

  test("maps pixel width to px CSS", () => {
    expect(renderButtonFrom({ width: "200px" }).style.width).toBe("200px");
  });

  test("maps percent width to percent CSS", () => {
    expect(renderButtonFrom({ width: "80%" }).style.width).toBe("80%");
  });

  test("drives padding through the responsive CSS var pair", () => {
    const button = renderButtonFrom({ padding: [8, 16, 8, 16] });
    expect(button.style.padding).toBe("");
    expect(button.style.getPropertyValue("--iam-padding")).toBe("8px 16px 8px 16px");
    expect(button.style.getPropertyValue("--iam-padding-desktop")).toBe("8px 16px 8px 16px");
  });

  test("stamps the desktop padding when provided", () => {
    const button = renderButtonFrom({ padding: [8, 16, 8, 16], paddingDesktop: [12, 24, 12, 24] });
    expect(button.style.getPropertyValue("--iam-padding")).toBe("8px 16px 8px 16px");
    expect(button.style.getPropertyValue("--iam-padding-desktop")).toBe("12px 24px 12px 24px");
  });

  test("drives margin through the responsive CSS var pair", () => {
    const button = renderButtonFrom({ margin: [4, 0, 4, 0] });
    expect(button.style.margin).toBe("");
    expect(button.style.getPropertyValue("--iam-margin")).toBe("4px 0px 4px 0px");
    expect(button.style.getPropertyValue("--iam-margin-desktop")).toBe("4px 0px 4px 0px");
  });

  test("stamps the desktop margin when provided", () => {
    const button = renderButtonFrom({ margin: [4, 0, 4, 0], marginDesktop: [8, 0, 8, 0] });
    expect(button.style.getPropertyValue("--iam-margin-desktop")).toBe("8px 0px 8px 0px");
  });

  test("bold decoration sets label fontWeight to 700", () => {
    const label = renderButtonFrom({ fontDecoration: ["bold"] }).querySelector(".iam-button-label") as HTMLSpanElement;
    expect(label.style.fontWeight).toBe("700");
  });

  test("italic decoration sets label fontStyle to italic", () => {
    const label = renderButtonFrom({ fontDecoration: ["italic"] }).querySelector(".iam-button-label") as HTMLSpanElement;
    expect(label.style.fontStyle).toBe("italic");
  });

  test("underline decoration sets textDecoration", () => {
    const label = renderButtonFrom({ fontDecoration: ["underline"] }).querySelector(".iam-button-label") as HTMLSpanElement;
    expect(label.style.textDecoration).toContain("underline");
  });

  test("stroke decoration sets line-through textDecoration", () => {
    const label = renderButtonFrom({ fontDecoration: ["stroke"] }).querySelector(".iam-button-label") as HTMLSpanElement;
    expect(label.style.textDecoration).toContain("line-through");
  });

  test("applies multi-line clamp to the label when maxLines is greater than 1", () => {
    const setProperty = jest.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    const label = renderButtonFrom({ maxLines: 3 }).querySelector(".iam-button-label") as HTMLSpanElement;

    expect(label.style.display).toBe("-webkit-box");
    expect(label.style.webkitLineClamp).toBe("3");
    expect(setProperty).toHaveBeenCalledWith("-webkit-box-orient", "vertical");
    setProperty.mockRestore();
  });

  test("reads label text from contentRef", () => {
    const label = renderButtonFrom().querySelector(".iam-button-label") as HTMLSpanElement;
    expect(label.textContent).toBe("A very long call to action");
  });

  test("falls back to empty text when contentRef is missing from texts", () => {
    const label = renderButtonFrom({ id: "missing" }).querySelector(".iam-button-label") as HTMLSpanElement;
    expect(label.textContent).toBe("");
  });
});
