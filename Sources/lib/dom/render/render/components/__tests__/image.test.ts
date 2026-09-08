/* eslint-env jest */

import type { MessageImageModel, MessageModel } from "com.batch.dom/render/model/model";
import { renderImage } from "com.batch.dom/render/render/components/image";

function makeImage(overrides?: {
  id?: string;
  contentRef?: string;
  aspect?: "fit" | "fill";
  radius?: [number, number, number, number];
  height?: MessageImageModel["configuration"]["placement"]["height"];
  accessibilityLabel?: string;
  margin?: [number, number, number, number];
}): MessageImageModel {
  return {
    type: "image",
    id: overrides?.id ?? "img1",
    configuration: {
      contentRef: overrides?.contentRef ?? "hero",
      style: {
        aspect: overrides?.aspect ?? "fit",
        radius: overrides?.radius ?? [0, 0, 0, 0],
      },
      placement: {
        margin: overrides?.margin ?? [0, 0, 0, 0],
        height: overrides?.height ?? "auto",
      },
      accessibility: {
        label: overrides?.accessibilityLabel,
      },
    },
  };
}

function makeMessage(overrides?: { urls?: Record<string, string>; actions?: Record<string, { type: string }> }): MessageModel {
  return {
    format: "modal",
    position: "center",
    root: {
      configuration: {
        style: { backgroundColor: ["#FFFFFFFF"], radius: [0, 0, 0, 0], borderWidth: 0, borderColor: ["#00000000"] },
        placement: { margin: [0, 0, 0, 0] },
      },
      children: [],
    },
    closeOptions: {},
    texts: {},
    urls: overrides?.urls ?? { hero: "https://example.com/img.png" },
    actions: (overrides?.actions ?? {}) as unknown as MessageModel["actions"],
    eventData: {},
  };
}

function renderRequired(...args: Parameters<typeof renderImage>): HTMLElement {
  const el = renderImage(...args);
  if (el === null) {
    throw new Error("expected the image component to render");
  }
  return el;
}

describe("renderImage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("has className iam-image", () => {
    const el = renderRequired(makeImage(), makeMessage(), jest.fn());
    expect(el.className).toBe("iam-image");
  });

  test("creates img element for safe https URL", () => {
    const el = renderRequired(makeImage(), makeMessage({ urls: { hero: "https://example.com/img.png" } }), jest.fn());
    expect(el.querySelector("img")).not.toBeNull();
  });

  test("creates img element for safe http URL", () => {
    const el = renderRequired(makeImage(), makeMessage({ urls: { hero: "http://example.com/img.png" } }), jest.fn());
    expect(el.querySelector("img")).not.toBeNull();
  });

  test("drops the whole component for javascript: URL", () => {
    const el = renderImage(makeImage(), makeMessage({ urls: { hero: "javascript:alert(1)" } }), jest.fn());
    expect(el).toBeNull();
  });

  test("drops the whole component for data: URL", () => {
    const el = renderImage(makeImage(), makeMessage({ urls: { hero: "data:image/png;base64,abc" } }), jest.fn());
    expect(el).toBeNull();
  });

  test("drops the whole component when URL is missing from message", () => {
    const el = renderImage(makeImage({ contentRef: "missing" }), makeMessage({ urls: {} }), jest.fn());
    expect(el).toBeNull();
  });

  test("uses accessibility label as alt text when provided", () => {
    const el = renderRequired(makeImage({ accessibilityLabel: "A hero image" }), makeMessage(), jest.fn());
    expect(el.querySelector("img")?.alt).toBe("A hero image");
  });

  test("uses Interactive as alt when action is present and no label", () => {
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage({ actions: { img1: { type: "batch.dismiss" } } }), jest.fn());
    expect(el.querySelector("img")?.alt).toBe("Interactive");
  });

  test("uses empty alt when no action and no accessibility label", () => {
    const el = renderRequired(makeImage(), makeMessage(), jest.fn());
    expect(el.querySelector("img")?.alt).toBe("");
  });

  test("aspect fit resolves to objectFit contain", () => {
    const el = renderRequired(makeImage({ aspect: "fit" }), makeMessage(), jest.fn());
    expect(el.querySelector("img")?.style.objectFit).toBe("contain");
  });

  test("aspect fill resolves to objectFit cover", () => {
    const el = renderRequired(makeImage({ aspect: "fill" }), makeMessage(), jest.fn());
    expect(el.querySelector("img")?.style.objectFit).toBe("cover");
  });

  test("sets cursor pointer and calls onAction when action is present", () => {
    const onAction = jest.fn();
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage({ actions: { img1: { type: "batch.dismiss" } } }), onAction);
    expect(el.style.cursor).toBe("pointer");
    el.click();
    expect(onAction).toHaveBeenCalledWith("img1");
  });

  test("no cursor pointer and no click handler when no action", () => {
    const onAction = jest.fn();
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage(), onAction);
    expect(el.style.cursor).not.toBe("pointer");
    el.click();
    expect(onAction).not.toHaveBeenCalled();
  });

  test("exposes the interactive wrapper as a focusable button", () => {
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage({ actions: { img1: { type: "batch.dismiss" } } }), jest.fn());
    expect(el.getAttribute("role")).toBe("button");
    expect(el.tabIndex).toBe(0);
  });

  test("leaves a non-interactive image out of the tab order and out of the a11y tree as a control", () => {
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage(), jest.fn());
    expect(el.hasAttribute("role")).toBe(false);
    expect(el.hasAttribute("tabindex")).toBe(false);
  });

  test("Enter and Space fire the action on the interactive wrapper", () => {
    const onAction = jest.fn();
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage({ actions: { img1: { type: "batch.dismiss" } } }), onAction);

    for (const key of ["Enter", " "]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenNthCalledWith(1, "img1");
    expect(onAction).toHaveBeenNthCalledWith(2, "img1");
  });

  test("an unrelated key never fires the action", () => {
    const onAction = jest.fn();
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage({ actions: { img1: { type: "batch.dismiss" } } }), onAction);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }));
    expect(onAction).not.toHaveBeenCalled();
  });

  test("a non-interactive image ignores Enter", () => {
    const onAction = jest.fn();
    const el = renderRequired(makeImage({ id: "img1" }), makeMessage(), onAction);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(onAction).not.toHaveBeenCalled();
  });

  test("height auto sets height style", () => {
    const el = renderRequired(makeImage({ height: "auto" }), makeMessage(), jest.fn());
    expect(el.style.height).toBe("auto");
  });

  test("height px sets height in pixels", () => {
    const el = renderRequired(makeImage({ height: { px: 200 } }), makeMessage(), jest.fn());
    expect(el.style.height).toBe("200px");
  });

  test("height fill sets flex grow", () => {
    const el = renderRequired(makeImage({ height: "fill" }), makeMessage(), jest.fn());
    expect(el.style.flex).not.toBe("");
  });

  test("sets border radius from style.radius", () => {
    const el = renderRequired(makeImage({ radius: [8, 8, 8, 8] }), makeMessage(), jest.fn());
    expect(el.style.borderRadius).toBe("8px 8px 8px 8px");
  });

  test("drives the wrapper margin through the responsive CSS var pair", () => {
    const el = renderRequired(makeImage({ margin: [8, 16, 8, 16] }), makeMessage(), jest.fn());
    expect(el.style.margin).toBe("");
    expect(el.style.getPropertyValue("--iam-margin")).toBe("8px 16px 8px 16px");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("8px 16px 8px 16px");
  });

  test("always keeps wrapper overflow hidden", () => {
    const el = renderRequired(makeImage(), makeMessage(), jest.fn());
    expect(el.style.overflow).toBe("hidden");
  });

  test("applies fill-parent styles to the internal image", () => {
    const el = renderRequired(makeImage(), makeMessage(), jest.fn());
    const img = el.querySelector("img") as HTMLImageElement;

    expect(img.style.width).toBe("100%");
    expect(img.style.height).toBe("100%");
    expect(img.style.display).toBe("block");
  });
});
