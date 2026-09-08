import type { MessageColor } from "com.batch.dom/render/model/types";

import { applyThemePair } from "../dom-utils";

export interface CloseButtonOptions {
  opts?: { color: MessageColor; backgroundColor?: MessageColor };
  ariaLabel?: string;
  onClose: () => void;
}

export function renderCloseButton({ opts, ariaLabel = "Close", onClose }: CloseButtonOptions): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "iam-close";
  btn.type = "button";
  btn.setAttribute("aria-label", ariaLabel);

  // Stryker disable all: the icon is geometry.
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("viewBox", "0 0 9 9");
  icon.setAttribute("width", "1em");
  icon.setAttribute("height", "1em");
  icon.setAttribute("fill", "none");
  icon.setAttribute("focusable", "false");
  icon.style.display = "block";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("clip-rule", "evenodd");

  path.setAttribute(
    "d",
    // eslint-disable-next-line max-len
    "M1.53033 0.46967C1.23744 0.176777 0.762563 0.176777 0.46967 0.46967C0.176777 0.762563 0.176777 1.23744 0.46967 1.53033L3.43934 4.5L0.46967 7.46967C0.176777 7.76256 0.176777 8.23744 0.46967 8.53033C0.762563 8.82322 1.23744 8.82322 1.53033 8.53033L4.5 5.56066L7.46967 8.53033C7.76256 8.82322 8.23744 8.82322 8.53033 8.53033C8.82322 8.23744 8.82322 7.76256 8.53033 7.46967L5.56066 4.5L8.53033 1.53033C8.82322 1.23744 8.82322 0.762563 8.53033 0.46967C8.23744 0.176777 7.76256 0.176777 7.46967 0.46967L4.5 3.43934L1.53033 0.46967Z"
  );
  path.setAttribute("fill", "currentColor");
  path.setAttribute("stroke-width", "0");
  // Stryker restore all

  icon.appendChild(path);
  btn.appendChild(icon);

  Object.assign(btn.style, {
    position: "absolute",
    top: "4px",
    right: "5px",
    width: "18px",
    height: "18px",
    minWidth: "18px",
    minHeight: "18px",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    zIndex: "1",
    padding: "0",
    fontSize: "11px",
    appearance: "none",
    WebkitAppearance: "none",
  });

  if (opts) {
    applyThemePair(btn, "iam-close-color", opts.color);
    if (opts.backgroundColor) {
      applyThemePair(btn, "iam-close-bg", opts.backgroundColor);
    }
  }

  btn.addEventListener("click", () => onClose());
  return btn;
}
