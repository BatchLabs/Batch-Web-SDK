import type { MessageSpacerModel } from "com.batch.dom/render/model/model";

import { createElement } from "../component-helpers";
import { resolveHeight } from "../dom-utils";

export function renderSpacer(component: MessageSpacerModel): HTMLElement {
  const el = createElement("div", "iam-spacer");
  el.style.flexShrink = "0";
  Object.assign(el.style, resolveHeight(component.configuration.placement.height));
  return el;
}
