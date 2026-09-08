import type { MessageModel } from "com.batch.dom/render/model/model";
import { applyResponsiveBox, applyThemePair, radiusToCSS } from "com.batch.dom/render/render/dom-utils";

import type { SurfaceContentLayout } from "./surface-strategy";

/** Applies the payload root styling (background, margin, radius, border) to a surface container; `box` gates margin, radius and border. */
export function applyRootConfigurationStyles(container: HTMLElement, message: MessageModel, options: { box: boolean }): void {
  const style = message.root.configuration.style;
  applyThemePair(container, "iam-surface-bg", style.backgroundColor, "#fff");

  if (!options.box) {
    return;
  }

  const placement = message.root.configuration.placement;
  applyResponsiveBox(container, "iam-root-margin", placement.margin, placement.marginDesktop);

  const radius = radiusToCSS(style.radius);
  if (radius) {
    container.style.borderRadius = radius;
  }

  if (style.borderWidth > 0) {
    container.style.borderStyle = "solid";
    container.style.borderWidth = `${style.borderWidth}px`;
    applyThemePair(container, "iam-surface-border-color", style.borderColor, "transparent");
  }
}

/** Caps and centers the content column of the root; does nothing when the surface declares no layout. */
export function applyContentLayout(root: HTMLElement, layout?: SurfaceContentLayout): void {
  if (!layout) {
    return;
  }
  root.classList.add("iam-root--capped");
  root.style.setProperty("--iam-content-max-width", `${layout.maxWidth}px`);
}
