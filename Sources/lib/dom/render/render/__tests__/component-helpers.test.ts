/* eslint-env jest */

import type { MessageButtonModel, MessageLabelModel, MessageModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import {
  applyBorderBoxStyles,
  applyMessageText,
  applyTextElementStyles,
  bindAction,
  createElement,
} from "com.batch.dom/render/render/component-helpers";
import { componentMessage, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";

function textStyles(patch: Record<string, unknown> = {}): {
  message: MessageModel;
  style: MessageLabelModel["configuration"]["style"];
  fontStyle: MessageLabelModel["configuration"]["fontStyle"];
} {
  const message = normalizeMessage(componentMessage({ type: "text", id: "title", ...patch }, { texts: { title: "Hello", blank: "" } }));
  const conf = selectFirstChild<MessageLabelModel>(message, "text").configuration;
  return { message, style: conf.style, fontStyle: conf.fontStyle };
}

function buttonConfiguration(patch: Record<string, unknown> = {}): MessageButtonModel["configuration"] {
  const message = normalizeMessage(componentMessage({ type: "button", id: "cta", ...patch }, { texts: { cta: "Send" } }));
  return selectFirstChild<MessageButtonModel>(message, "button").configuration;
}

describe("createElement", () => {
  test("creates the requested tag, stamps the class and leaves the node detached", () => {
    const el = createElement("input", "iam-input");
    expect(el.tagName).toBe("INPUT");
    expect(el.className).toBe("iam-input");
    expect(el.isConnected).toBe(false);
  });

  test("an empty class name leaves no class token behind", () => {
    const el = createElement("div", "");
    expect(el.className).toBe("");
    expect(el.classList.length).toBe(0);
  });
});

describe("applyMessageText", () => {
  test("writes the resolved text for the content ref", () => {
    const { message } = textStyles();
    const el = document.createElement("p");
    applyMessageText(el, message, "title");
    expect(el.textContent).toBe("Hello");
  });

  test("an unresolved content ref clears the node instead of leaving stale text", () => {
    const { message } = textStyles();
    const el = document.createElement("p");
    el.textContent = "previous render";
    applyMessageText(el, message, "missing");
    expect(el.textContent).toBe("");
  });

  test("a text entry resolving to an empty string renders as empty", () => {
    const { message } = textStyles();
    const el = document.createElement("p");
    applyMessageText(el, message, "blank");
    expect(el.textContent).toBe("");
  });
});

describe("applyTextElementStyles", () => {
  test("omitting lineHeight and minWidthZero leaves both properties untouched", () => {
    const { style, fontStyle } = textStyles();
    const el = document.createElement("span");
    applyTextElementStyles(el, { style, fontStyle });
    expect(el.style.lineHeight).toBe("");
    expect(el.style.minWidth).toBe("");
  });

  test("lineHeight and minWidthZero are applied when requested", () => {
    const { style, fontStyle } = textStyles();
    const el = document.createElement("p");
    applyTextElementStyles(el, { style, fontStyle, lineHeight: "1.4", minWidthZero: true });
    expect(el.style.lineHeight).toBe("1.4");
    expect(el.style.minWidth).toMatch(/^0(px)?$/);
  });

  test("an unresolvable text color falls back to inherit on both themes", () => {
    const { style, fontStyle } = textStyles();
    const el = document.createElement("p");
    applyTextElementStyles(el, { style: { ...style, color: [""] }, fontStyle });
    expect(el.style.getPropertyValue("--iam-color")).toBe("inherit");
    expect(el.style.getPropertyValue("--iam-color-dark")).toBe("inherit");
  });
});

describe("applyBorderBoxStyles", () => {
  test("an unresolvable background falls back to transparent on both themes", () => {
    const conf = buttonConfiguration();
    const el = document.createElement("div");
    applyBorderBoxStyles(el, { style: { ...conf.style, backgroundColor: [""] } });
    expect(el.style.getPropertyValue("--iam-bg")).toBe("transparent");
    expect(el.style.getPropertyValue("--iam-bg-dark")).toBe("transparent");
  });

  test("an unresolvable border color falls back to transparent on both themes", () => {
    const conf = buttonConfiguration();
    const el = document.createElement("div");
    applyBorderBoxStyles(el, { style: { ...conf.style, borderColor: [""] } });
    expect(el.style.getPropertyValue("--iam-border-color")).toBe("transparent");
    expect(el.style.getPropertyValue("--iam-border-color-dark")).toBe("transparent");
  });

  test("omitting the margin writes neither margin variable", () => {
    const conf = buttonConfiguration({ borderWidth: 3, radius: [4, 4, 4, 4] });
    const el = document.createElement("div");
    applyBorderBoxStyles(el, { style: conf.style });
    expect(el.style.getPropertyValue("--iam-margin")).toBe("");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("");
    expect(el.style.borderWidth).toBe("3px");
    expect(el.style.borderRadius).toBe("4px 4px 4px 4px");
  });

  test("a margin without a desktop override still writes the pair", () => {
    const conf = buttonConfiguration({ margin: [4, 0, 4, 0] });
    const el = document.createElement("div");
    applyBorderBoxStyles(el, { style: conf.style, margin: conf.placement.margin, marginDesktop: conf.placement.marginDesktop });
    expect(el.style.getPropertyValue("--iam-margin")).toBe("4px 0px 4px 0px");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("4px 0px 4px 0px");
  });
});

describe("bindAction", () => {
  test("marks the element clickable and forwards the action id on every click", () => {
    const onAction = jest.fn();
    const el = document.createElement("div");
    bindAction(el, "cta", onAction);

    expect(el.style.cursor).toBe("pointer");
    el.click();
    el.click();
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenNthCalledWith(1, "cta");
  });
});
