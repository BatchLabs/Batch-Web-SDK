/* eslint-env jest */

import type { MessageSpacerModel } from "com.batch.dom/render/model/model";
import { DEFAULT_SPACER_HEIGHT } from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageSpacerPayload } from "com.batch.dom/render/model/types";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { componentMessage, runComponentMatrix, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";

const FALLBACK_HEIGHT_CSS = "0px";

const props: PropMatrix<MessageSpacerPayload, MessageSpacerModel> = {
  height: {
    cases: [
      {
        name: "0px → { px: 0 }",
        patch: { height: "0px" },
        expectModel: m => expect(m.configuration.placement.height).toEqual({ px: 0 }),
        expectCss: el => {
          expect(el.style.height).toBe("0px");
          expect(el.style.flexShrink).toBe("0");
        },
      },
      {
        name: "24px → { px: 24 }",
        patch: { height: "24px" },
        expectModel: m => expect(m.configuration.placement.height).toEqual({ px: 24 }),
        expectCss: el => expect(el.style.height).toBe("24px"),
      },
      {
        name: "fractional 12.5px → { px: 12.5 }",
        patch: { height: "12.5px" },
        expectModel: m => expect(m.configuration.placement.height).toEqual({ px: 12.5 }),
        expectCss: el => expect(el.style.height).toBe("12.5px"),
      },
      {
        name: "whitespace trimmed ' 32px ' → { px: 32 }",
        patch: { height: " 32px " },
        expectModel: m => expect(m.configuration.placement.height).toEqual({ px: 32 }),
        expectCss: el => expect(el.style.height).toBe("32px"),
      },

      {
        name: "fill → 'fill' / flex 1 1 0 + minHeight 0, no height",
        patch: { height: "fill" },
        expectModel: m => expect(m.configuration.placement.height).toBe("fill"),
        expectCss: el => {
          expect(el.style.flex).toBe("1 1 0px");
          expect(el.style.minHeight).toBe("0");
          expect(el.style.height).toBe("");
        },
      },

      {
        name: "auto → 'auto' / height auto",
        patch: { height: "auto" },
        expectModel: m => expect(m.configuration.placement.height).toBe("auto"),
        expectCss: el => {
          expect(el.style.height).toBe("auto");
          expect(el.style.flexShrink).toBe("0");
        },
      },

      {
        name: "invalid 'stretch' → DEFAULT_SPACER_HEIGHT",
        patch: { height: "stretch" },
        expectModel: m => expect(m.configuration.placement.height).toEqual(DEFAULT_SPACER_HEIGHT),
        expectCss: el => expect(el.style.height).toBe(FALLBACK_HEIGHT_CSS),
      },
      {
        name: "percent '50%' unsupported → DEFAULT_SPACER_HEIGHT",
        patch: { height: "50%" },
        expectModel: m => expect(m.configuration.placement.height).toEqual(DEFAULT_SPACER_HEIGHT),
        expectCss: el => expect(el.style.height).toBe(FALLBACK_HEIGHT_CSS),
      },
      {
        name: "bare number '24' (no unit) → DEFAULT_SPACER_HEIGHT",
        patch: { height: "24" },
        expectModel: m => expect(m.configuration.placement.height).toEqual(DEFAULT_SPACER_HEIGHT),
        expectCss: el => expect(el.style.height).toBe(FALLBACK_HEIGHT_CSS),
      },
      {
        name: "empty string → DEFAULT_SPACER_HEIGHT",
        patch: { height: "" },
        expectModel: m => expect(m.configuration.placement.height).toEqual(DEFAULT_SPACER_HEIGHT),
        expectCss: el => expect(el.style.height).toBe(FALLBACK_HEIGHT_CSS),
      },
      {
        name: "omitted → DEFAULT_SPACER_HEIGHT",
        patch: { height: undefined },
        expectModel: m => expect(m.configuration.placement.height).toEqual(DEFAULT_SPACER_HEIGHT),
        expectCss: el => expect(el.style.height).toBe(FALLBACK_HEIGHT_CSS),
      },
      {
        name: "non-string (number) → DEFAULT_SPACER_HEIGHT",
        patch: { height: 24 },
        expectModel: m => expect(m.configuration.placement.height).toEqual(DEFAULT_SPACER_HEIGHT),
        expectCss: el => expect(el.style.height).toBe(FALLBACK_HEIGHT_CSS),
      },
    ],
  },

  hideOn: {
    cases: [
      {
        name: "mobile → class iam-hide-mobile",
        patch: { hideOn: "mobile" },
        expectModel: m => expect(m.hideOn).toBe("mobile"),
        expectCss: el => expect(el.className).toContain("iam-hide-mobile"),
      },
      {
        name: "desktop → class iam-hide-desktop",
        patch: { hideOn: "desktop" },
        expectModel: m => expect(m.hideOn).toBe("desktop"),
        expectCss: el => expect(el.className).toContain("iam-hide-desktop"),
      },
      {
        name: "omitted → undefined, no hide class",
        patch: {},
        expectModel: m => expect(m.hideOn).toBeUndefined(),
        expectCss: el => expect(el.className).not.toContain("iam-hide"),
      },
      {
        name: "invalid → undefined, no hide class",
        patch: { hideOn: "sideways" },
        expectModel: m => expect(m.hideOn).toBeUndefined(),
        expectCss: el => expect(el.className).not.toContain("iam-hide"),
      },
    ],
  },
};

const spec: ComponentMatrixSpec<MessageSpacerPayload, MessageSpacerModel> = {
  label: "Spacer",
  buildPayload: (patch, message) => componentMessage({ type: "spacer", height: "24px", ...patch }, message),
  select: message => selectFirstChild<MessageSpacerModel>(message, "spacer"),
  props,
};

runComponentMatrix(spec);
