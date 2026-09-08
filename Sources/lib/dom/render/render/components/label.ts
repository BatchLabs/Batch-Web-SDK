import type { MessageLabelModel, MessageModel } from "com.batch.dom/render/model/model";

import { applyMessageText, applyTextElementStyles, createElement } from "../component-helpers";
import { applyResponsiveBox } from "../dom-utils";

export function renderLabel(component: MessageLabelModel, message: MessageModel): HTMLElement {
  const el = createElement("p", "iam-text");

  const conf = component.configuration;
  applyMessageText(el, message, conf.contentRef);
  applyTextElementStyles(el, {
    style: conf.style,
    fontStyle: conf.fontStyle,
    lineHeight: "1.4",
    minWidthZero: true,
  });
  applyResponsiveBox(el, "iam-margin", conf.placement.margin, conf.placement.marginDesktop);

  return el;
}
