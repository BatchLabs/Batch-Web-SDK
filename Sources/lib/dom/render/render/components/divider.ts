import type { MessageDividerModel } from "com.batch.dom/render/model/model";

import { createElement } from "../component-helpers";
import { applyResponsiveBox, applyThemePair } from "../dom-utils";
import { applyFlexItemWidth } from "../style-utils";

export function renderDivider(component: MessageDividerModel): HTMLElement {
  const el = createElement("hr", "iam-divider");
  el.style.borderStyle = "solid";
  el.style.borderRightWidth = "0px";
  el.style.borderBottomWidth = "0px";
  el.style.borderLeftWidth = "0px";

  const conf = component.configuration;
  applyThemePair(el, "iam-border-color", conf.style.color);
  el.style.borderTopWidth = `${conf.style.thickness}px`;
  applyResponsiveBox(el, "iam-margin", conf.placement.margin, conf.placement.marginDesktop);
  applyFlexItemWidth(el, conf.placement.width, conf.placement.align);
  return el;
}
