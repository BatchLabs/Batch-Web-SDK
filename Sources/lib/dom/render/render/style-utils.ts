import type { MessageAspectRatio, MessageWidthType } from "com.batch.dom/render/model/model";
import type { MessageHorizontalAlignment, MessageVerticalAlignment } from "com.batch.dom/render/model/types";

import { resolveWidth } from "./dom-utils";

export function resolveAlignSelf(align: MessageHorizontalAlignment): string {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
}

/** Sizes a flex item from its payload width. A full width stretches, so it fits inside the margin box. */
export function applyFlexItemWidth(el: HTMLElement, width: MessageWidthType, align: MessageHorizontalAlignment): void {
  if (width === "fill" || ("percent" in width && width.percent === 100)) {
    el.style.alignSelf = "stretch";
    return;
  }
  el.style.width = resolveWidth(width);
  el.style.alignSelf = resolveAlignSelf(align);
}

export function resolveAlignItems(align: MessageVerticalAlignment): string {
  if (align === "center") return "center";
  if (align === "bottom") return "flex-end";
  return "flex-start";
}

export function resolveObjectFit(aspect: MessageAspectRatio): "contain" | "cover" {
  return aspect === "fit" ? "contain" : "cover";
}

export function resolveFlexWeight(weight: number): string {
  return `${weight} 1 0`;
}

export function applyFillImage(el: HTMLElement): void {
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.display = "block";
}
