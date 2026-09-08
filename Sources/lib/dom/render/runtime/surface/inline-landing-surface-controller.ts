import { MessageVerticalAlignment, MessageVerticalAlignmentValue } from "com.batch.dom/render/model/types";
import { buildComponentTree } from "com.batch.dom/render/render/builder";
import { applyThemePair } from "com.batch.dom/render/render/dom-utils";

import { IS_WEBPACK_DEV_SERVER } from "../../../../../config";
import { applyContentLayout, applyRootConfigurationStyles } from "./root-configuration";
import type { SurfacePresentation, SurfacePresentationParams } from "./surface-strategy";

import rawCss from "com.batch.dom/render/render/render.raw.css";

const POSITION_JUSTIFY: Record<MessageVerticalAlignment, string> = {
  [MessageVerticalAlignmentValue.Top]: "flex-start",
  [MessageVerticalAlignmentValue.Center]: "center",
  [MessageVerticalAlignmentValue.Bottom]: "flex-end",
};

/** Inline surface for landing pages: renders the component tree into a shadow root, with no modal control and no scroll lock. */
export class InlineLandingSurfaceController implements SurfacePresentation {
  public readonly element: HTMLElement;
  private readonly shadow: ShadowRoot;
  private disposeForm: (() => void) | null = null;

  public constructor({ message, contentLayout, onAction }: SurfacePresentationParams) {
    const host = document.createElement("main");
    host.className = "batch-lp-surface";

    // CSS position, not the payload `position` prop: inline styles beat any shared-stylesheet rule.
    host.style.position = "static";
    host.style.width = "100%";
    // `min-height` reserves the viewport height; the second assignment upgrades to `dvh` where it parses, others keep `vh`.
    host.style.display = "flex";
    host.style.flexDirection = "column";
    host.style.minHeight = "100vh";
    host.style.minHeight = "100dvh";
    // The stylesheet reads this pair through `:host(.batch-lp-surface)`.
    applyThemePair(host, "iam-surface-bg", message.root.configuration.style.backgroundColor, "#fff");

    this.shadow = host.attachShadow({ mode: IS_WEBPACK_DEV_SERVER ? "open" : "closed" });
    const style = document.createElement("style");
    style.textContent = rawCss;
    this.shadow.appendChild(style);

    const root = buildComponentTree(
      message,
      onAction,
      dispose => {
        this.disposeForm = dispose;
      },
      // The decoy field lets the webservice route a bot submit to its own topic.
      { decoyField: true }
    );
    root.classList.add("iam-root--surface");
    // The root fills the host and distributes the free space, so a `fill` spacer takes it first, as on the natives.
    root.style.justifyContent = POSITION_JUSTIFY[message.position];
    applyRootConfigurationStyles(root, message, { box: true });
    applyContentLayout(root, contentLayout);
    this.shadow.appendChild(root);

    this.element = host;
  }

  public destroy(): void {
    // Detach the form before the host leaves the DOM, so an in-flight submit sees a disposed controller.
    this.disposeForm?.();
    this.element.remove();
  }
}
