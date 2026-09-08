import type {
  MessageBorderStyle,
  MessageFontStyle,
  MessageMarginPlacement,
  MessageModel,
  MessageTextStyleModel,
} from "com.batch.dom/render/model/model";

import { applyFontDecoration, applyLineClamp, applyRadius, applyResponsiveBox, applyResponsiveLength, applyThemePair } from "./dom-utils";

interface TextElementOptions {
  style: MessageTextStyleModel;
  fontStyle: MessageFontStyle;
  lineHeight?: string;
  minWidthZero?: boolean;
}

interface BorderBoxOptions {
  style: MessageBorderStyle;
  margin?: MessageMarginPlacement["margin"];
  marginDesktop?: MessageMarginPlacement["marginDesktop"];
}

export function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

export function applyMessageText(el: HTMLElement, message: MessageModel, contentRef: string): void {
  el.textContent = message.texts[contentRef] ?? "";
}

/** Resolves a reserved `texts` key. A missing or empty entry keeps the fallback. */
export function resolveMessageText(texts: Readonly<Record<string, string>>, key: string, fallback: string): string {
  const text = texts[key];
  return typeof text === "string" && text.length > 0 ? text : fallback;
}

export function applyTextElementStyles(el: HTMLElement, options: TextElementOptions): void {
  applyResponsiveLength(el, "iam-font-size", options.fontStyle.fontSize, options.fontStyle.fontSizeDesktop);
  applyThemePair(el, "iam-color", options.style.color, "inherit");
  el.style.textAlign = options.style.align;
  if (options.lineHeight) {
    el.style.lineHeight = options.lineHeight;
  }
  if (options.minWidthZero) {
    el.style.minWidth = "0";
  }

  applyLineClamp(el, options.style.maxLines);
  applyFontDecoration(el, options.fontStyle.fontDecoration);
}

export function applyBorderBoxStyles(el: HTMLElement, options: BorderBoxOptions): void {
  applyThemePair(el, "iam-bg", options.style.backgroundColor, "transparent");
  applyThemePair(el, "iam-border-color", options.style.borderColor, "transparent");
  applyResponsiveBox(el, "iam-margin", options.margin, options.marginDesktop);
  applyRadius(el, options.style.radius);
  el.style.borderWidth = `${options.style.borderWidth}px`;
}

export function bindAction(el: HTMLElement, actionId: string | undefined, onAction: (componentId: string) => void): void {
  if (!actionId) {
    return;
  }

  el.style.cursor = "pointer";
  el.addEventListener("click", () => onAction(actionId));
}
