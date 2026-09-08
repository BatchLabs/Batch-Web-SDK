import type { MessageButtonModel, MessageModel } from "com.batch.dom/render/model/model";

import { applyBorderBoxStyles, applyMessageText, applyTextElementStyles, bindAction, createElement } from "../component-helpers";
import { applyResponsiveBox, applyThemePair } from "../dom-utils";
import { applyFlexItemWidth } from "../style-utils";

export function renderButton(
  component: MessageButtonModel,
  message: MessageModel,
  onAction: (componentId: string) => void
): HTMLButtonElement {
  const el = createElement("button", "iam-button");
  const label = createElement("span", "iam-button-label");
  el.type = "button";
  label.style.display = "block";
  label.style.width = "100%";

  const conf = component.configuration;
  applyMessageText(label, message, conf.contentRef);
  applyTextElementStyles(label, {
    style: {
      align: conf.style.align,
      color: conf.style.color,
      maxLines: conf.style.maxLines,
    },
    fontStyle: conf.fontStyle,
  });
  el.style.display = "block";
  el.style.fontFamily = "inherit";
  el.style.borderStyle = "solid";
  applyThemePair(el, "iam-color", conf.style.color, "inherit");
  el.style.textAlign = conf.style.align;
  applyFlexItemWidth(el, conf.placement.width, conf.placement.align);
  applyBorderBoxStyles(el, {
    style: {
      backgroundColor: conf.style.backgroundColor,
      radius: conf.style.radius,
      borderWidth: conf.style.borderWidth,
      borderColor: conf.style.borderColor,
    },
    margin: conf.placement.margin,
    marginDesktop: conf.placement.marginDesktop,
  });
  applyResponsiveBox(el, "iam-padding", conf.placement.padding, conf.placement.paddingDesktop);
  el.appendChild(label);
  bindAction(el, conf.actionRef || component.id, onAction);
  return el;
}

/** Renders the `batch.form.submit` button: a regular button plus a spinner and a check mark. */
export function renderSubmitButton(component: MessageButtonModel, message: MessageModel, onSubmit: () => void): HTMLButtonElement {
  const el = renderButton(component, message, onSubmit);
  el.classList.add("iam-button--submit");
  const spinner = createElement("span", "iam-button-spinner");
  spinner.setAttribute("aria-hidden", "true");
  el.appendChild(spinner);
  el.appendChild(createCheckIcon());
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createCheckIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "iam-button-check");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("d", "M10 0a10 10 0 1 1 0 20a10 10 0 1 1 0-20zM14.6 6.2L8.8 12L6.2 9.4L4.8 10.8L8.8 14.8L16 7.6z");
  svg.appendChild(path);
  return svg;
}
