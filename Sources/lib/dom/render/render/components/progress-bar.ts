import type { MessageColor } from "com.batch.dom/render/model/types";

import { applyThemePair } from "../dom-utils";

const DEFAULT_PROGRESS_COLOR = "#007aff";

export interface SurfaceProgressBarOptions {
  totalDelay: number;
  elapsed: number;
  color: MessageColor | undefined;
}

function createProgressBarBase(style: Partial<CSSStyleDeclaration>, color: MessageColor | undefined): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "iam-progress";
  Object.assign(bar.style, style);
  if (color) {
    applyThemePair(bar, "iam-progress-color", color, DEFAULT_PROGRESS_COLOR);
  }
  return bar;
}

/** Progress bar for the modal and fullscreen formats. `elapsed` resumes the animation mid-way. */
export function renderSurfaceProgressBar({ totalDelay, elapsed, color }: SurfaceProgressBarOptions): HTMLElement {
  return createProgressBarBase(
    {
      position: "absolute",
      top: "0",
      left: "0",
      height: "2px",
      width: "100%",
      transformOrigin: "left center",
      transform: "scaleX(1)",
      willChange: "transform",
      borderRadius: "1px",
      zIndex: "2",
      animationName: "iam-progress-countdown",
      animationTimingFunction: "linear",
      animationFillMode: "forwards",
      animationDuration: `${totalDelay}s`,
      animationDelay: `-${elapsed}s`,
    },
    color
  );
}
