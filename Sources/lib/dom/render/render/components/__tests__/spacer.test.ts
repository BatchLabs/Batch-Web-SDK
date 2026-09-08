/* eslint-env jest */

import type { MessageSpacerModel } from "com.batch.dom/render/model/model";
import { renderSpacer } from "com.batch.dom/render/render/components/spacer";

function makeSpacer(height: MessageSpacerModel["configuration"]["placement"]["height"]): MessageSpacerModel {
  return {
    type: "spacer",
    configuration: {
      placement: { height },
    },
  };
}

describe("renderSpacer", () => {
  test("has className iam-spacer", () => {
    const el = renderSpacer(makeSpacer("auto"));
    expect(el.className).toBe("iam-spacer");
  });

  test("sets flexShrink to 0 for auto height", () => {
    const el = renderSpacer(makeSpacer("auto"));
    expect(el.style.flexShrink).toBe("0");
  });

  test("sets flexShrink to 0 for px height", () => {
    const el = renderSpacer(makeSpacer({ px: 24 }));
    expect(el.style.flexShrink).toBe("0");
  });

  test("auto height sets height auto", () => {
    const el = renderSpacer(makeSpacer("auto"));
    expect(el.style.height).toBe("auto");
  });

  test("px height sets height in pixels", () => {
    const el = renderSpacer(makeSpacer({ px: 24 }));
    expect(el.style.height).toBe("24px");
  });

  test("fill height sets flex grow style", () => {
    const el = renderSpacer(makeSpacer("fill"));
    expect(el.style.flex).not.toBe("");
  });

  test("fill height sets minHeight", () => {
    const el = renderSpacer(makeSpacer("fill"));
    expect(el.style.minHeight).not.toBe("");
  });
});
