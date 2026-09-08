/* eslint-env jest */

import { renderCloseButton } from "com.batch.dom/render/render/components/close-button";
import { renderSurfaceProgressBar } from "com.batch.dom/render/render/components/progress-bar";

describe("in-app theme source vars", () => {
  test("close button does not stamp a background source var when only the color is customized", () => {
    const button = renderCloseButton({
      opts: {
        color: ["#FFFFFFFF"],
      },
      onClose: jest.fn(),
    });

    expect(button.style.getPropertyValue("--iam-close-color")).toBe("rgba(255,255,255,1.000)");
    expect(button.style.getPropertyValue("--iam-close-color-dark")).toBe("rgba(255,255,255,1.000)");
    expect(button.style.getPropertyValue("--iam-close-bg")).toBe("");
    expect(button.style.getPropertyValue("--iam-close-bg-dark")).toBe("");
  });

  test("surface progress bar does not stamp a source var when no payload color is provided", () => {
    const bar = renderSurfaceProgressBar({
      totalDelay: 2,
      elapsed: 0,
      color: undefined,
    });

    expect(bar.style.getPropertyValue("--iam-progress-color")).toBe("");
    expect(bar.style.getPropertyValue("--iam-progress-color-dark")).toBe("");
  });
});
