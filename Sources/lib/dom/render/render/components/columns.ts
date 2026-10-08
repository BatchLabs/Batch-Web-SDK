import type { MessageComponentModel, MessageColumnsModel } from "com.batch.dom/render/model/model";

import { createElement } from "../component-helpers";
import { applyRadius, applyResponsiveBox, applyThemePair } from "../dom-utils";
import { resolveAlignItems, resolveFlexWeight } from "../style-utils";

export function renderColumns(
  component: MessageColumnsModel,
  renderChild: (child: MessageComponentModel) => HTMLElement | null
): HTMLElement {
  const el = createElement("div", "iam-columns");
  el.style.display = "flex";
  el.style.flexDirection = "row";

  const conf = component.configuration;
  if (conf.style.spacing > 0) el.style.gap = `${conf.style.spacing}px`;
  el.style.alignItems = resolveAlignItems(conf.style.contentAlign);

  applyThemePair(el, "iam-bg", conf.style.backgroundColor);
  applyRadius(el, conf.style.radius);
  applyResponsiveBox(el, "iam-margin", conf.placement.margin, conf.placement.marginDesktop);
  applyResponsiveBox(el, "iam-padding", conf.placement.padding, conf.placement.paddingDesktop);

  const { children, ratios } = conf;
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const col = createElement("div", "iam-column");
    const ratio = ratios[i] ?? 0;
    const weight = total > 0 ? ratio / total : 1 / Math.max(children.length, 1);
    col.style.flex = resolveFlexWeight(weight);
    col.style.minWidth = "0";
    // A flex column: `align-self: stretch` on a full-width child has no effect in a block layout.
    col.style.display = "flex";
    col.style.flexDirection = "column";

    if (child) {
      const childEl = renderChild(child);
      if (childEl) col.appendChild(childEl);
    }

    el.appendChild(col);
  }

  return el;
}
