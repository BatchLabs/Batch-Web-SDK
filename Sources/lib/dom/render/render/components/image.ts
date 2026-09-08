import type { MessageImageModel, MessageModel } from "com.batch.dom/render/model/model";
import { RENDER_TEXT_KEY_IMAGE_INTERACTIVE } from "com.batch.dom/render/render-constants";
import { isSafeURL } from "com.batch.shared/helpers/url";

import { bindAction, createElement } from "../component-helpers";
import { applyRadius, applyResponsiveBox, resolveHeight } from "../dom-utils";
import { applyFillImage, resolveObjectFit } from "../style-utils";

const DEFAULT_INTERACTIVE_ALT = "Interactive";

export function renderImage(
  component: MessageImageModel,
  message: MessageModel,
  onAction: (componentId: string) => void
): HTMLElement | null {
  const conf = component.configuration;

  // Drop the whole component, so its reserved height leaves no empty gap.
  const url = message.urls[conf.contentRef];
  if (!url || !isSafeURL(url)) {
    return null;
  }

  const wrapper = createElement("div", "iam-image");
  Object.assign(wrapper.style, resolveHeight(conf.placement.height));
  wrapper.style.overflow = "hidden";

  applyResponsiveBox(wrapper, "iam-margin", conf.placement.margin, conf.placement.marginDesktop);
  applyRadius(wrapper, conf.style.radius);

  const img = document.createElement("img");
  img.src = url;
  const hasAction = Boolean(message.actions[component.id]);
  img.alt = conf.accessibility.label ?? (hasAction ? (message.texts[RENDER_TEXT_KEY_IMAGE_INTERACTIVE] ?? DEFAULT_INTERACTIVE_ALT) : "");
  applyFillImage(img);
  img.style.objectFit = resolveObjectFit(conf.style.aspect);
  wrapper.appendChild(img);

  if (hasAction) {
    bindAction(wrapper, component.id, onAction);
    // The wrapper carries the action, so it needs `role` and `tabindex`; a native `button` would fight the frame box model.
    wrapper.setAttribute("role", "button");
    wrapper.tabIndex = 0;
    wrapper.addEventListener("keydown", event => {
      // Space scrolls the page by default, and a `button` activates on Space
      // and on Enter. Match that contract.
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onAction(component.id);
      }
    });
  }

  return wrapper;
}
