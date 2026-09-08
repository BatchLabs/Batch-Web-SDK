/* eslint-env jest */

import type { MessageDividerModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_DIVIDER_THICKNESS,
  DEFAULT_DIVIDER_WIDTH,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_HORIZONTAL_ALIGN,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageDividerPayload } from "com.batch.dom/render/model/types";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import {
  componentMessage,
  expectResponsivePair,
  expectThemePair,
  runComponentMatrix,
  selectFirstChild,
} from "com.batch.dom/render/test-utils/prop-matrix";

const FALLBACK_COLOR_CSS = { light: "rgba(0,0,0,1.000)", dark: "rgba(255,255,255,1.000)" };
const FALLBACK_BOX_CSS = "0px 0px 0px 0px";
const expectFullWidth = (el: HTMLElement): void => {
  expect(el.style.width).toBe("");
  expect(el.style.alignSelf).toBe("stretch");
};

const props: PropMatrix<MessageDividerPayload, MessageDividerModel> = {
  color: {
    cases: [
      {
        name: "light+dark pair",
        patch: { color: ["#FF0000FF", "#00FF00FF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el => expectThemePair(el, "iam-border-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" }),
      },
      {
        name: "single → dark mirrors light",
        patch: { color: ["#ABCDEFFF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#ABCDEFFF", "#ABCDEFFF"]),
        expectCss: el => expectThemePair(el, "iam-border-color", { light: "rgba(171,205,239,1.000)" }),
      },
      {
        name: "#RRGGBBAA → rgba with alpha",
        patch: { color: ["#0044FF80"] },
        expectCss: el => expectThemePair(el, "iam-border-color", { light: "rgba(0,68,255,0.502)" }),
      },
      {
        name: "#RRGGBB → passthrough",
        patch: { color: ["#123456"] },
        expectCss: el => expectThemePair(el, "iam-border-color", { light: "#123456" }),
      },
      {
        name: "omitted → DEFAULT_FALLBACK_COLOR",
        patch: { color: undefined },
        expectModel: m => expect(m.configuration.style.color).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(el, "iam-border-color", FALLBACK_COLOR_CSS),
      },
      {
        name: "invalid → DEFAULT_FALLBACK_COLOR",
        patch: { color: ["red"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(el, "iam-border-color", FALLBACK_COLOR_CSS),
      },
    ],
  },

  thickness: {
    cases: [
      {
        name: "explicit → borderTopWidth",
        patch: { thickness: 5 },
        expectModel: m => expect(m.configuration.style.thickness).toBe(5),
        expectCss: el => {
          expect(el.style.borderTopWidth).toBe("5px");
          expect(el.style.borderRightWidth).toBe("0px");
          expect(el.style.borderBottomWidth).toBe("0px");
          expect(el.style.borderLeftWidth).toBe("0px");
        },
      },
      {
        name: "omitted → DEFAULT_DIVIDER_THICKNESS",
        patch: { thickness: undefined },
        expectModel: m => expect(m.configuration.style.thickness).toBe(DEFAULT_DIVIDER_THICKNESS),
        expectCss: el => expect(el.style.borderTopWidth).toBe(`${DEFAULT_DIVIDER_THICKNESS}px`),
      },
      {
        name: "floored to integer",
        patch: { thickness: 3.9 },
        expectModel: m => expect(m.configuration.style.thickness).toBe(3),
        expectCss: el => expect(el.style.borderTopWidth).toBe("3px"),
      },
      {
        name: "invalid → default",
        patch: { thickness: "thick" },
        expectModel: m => expect(m.configuration.style.thickness).toBe(DEFAULT_DIVIDER_THICKNESS),
        expectCss: el => expect(el.style.borderTopWidth).toBe(`${DEFAULT_DIVIDER_THICKNESS}px`),
      },
      {
        name: "negative → default",
        patch: { thickness: -2 },
        expectModel: m => expect(m.configuration.style.thickness).toBe(DEFAULT_DIVIDER_THICKNESS),
        expectCss: el => expect(el.style.borderTopWidth).toBe(`${DEFAULT_DIVIDER_THICKNESS}px`),
      },
    ],
  },

  margin: {
    cases: [
      {
        name: "explicit → --iam-margin pair",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([8, 16, 4, 12]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
      {
        name: "shorthand [10,20] → [10,20,10,20]",
        patch: { margin: [10, 20] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([10, 20, 10, 20]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "10px 20px 10px 20px" }),
      },
      {
        name: "omitted → DEFAULT_BOX_FALLBACK box",
        patch: {},
        expectModel: m =>
          expect(m.configuration.placement.margin).toEqual([
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
          ]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: FALLBACK_BOX_CSS }),
      },
      {
        name: "invalid → DEFAULT_BOX_FALLBACK box",
        patch: { margin: ["8", "16"] },
        expectModel: m =>
          expect(m.configuration.placement.margin).toEqual([
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
          ]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: FALLBACK_BOX_CSS }),
      },
    ],
  },

  marginDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { margin: [8, 16, 4, 12], marginDesktop: [16, 32, 8, 24] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toEqual([16, 32, 8, 24]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px", desktop: "16px 32px 8px 24px" }),
      },
      {
        name: "omitted → model undefined, desktop mirrors base",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
      {
        name: "invalid → model undefined, desktop mirrors base",
        patch: { margin: [8, 16, 4, 12], marginDesktop: [] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
    ],
  },

  width: {
    cases: [
      {
        name: "fill → stretch inside the margin box",
        patch: { width: "fill" },
        expectModel: m => expect(m.configuration.placement.width).toBe("fill"),
        expectCss: expectFullWidth,
      },
      {
        name: "px",
        patch: { width: "300px" },
        expectModel: m => expect(m.configuration.placement.width).toEqual({ px: 300 }),
        expectCss: el => expect(el.style.width).toBe("300px"),
      },
      {
        name: "percent",
        patch: { width: "50%" },
        expectModel: m => expect(m.configuration.placement.width).toEqual({ percent: 50 }),
        expectCss: el => expect(el.style.width).toBe("50%"),
      },
      {
        name: "omitted → DEFAULT_DIVIDER_WIDTH (100%) → stretch",
        patch: { width: undefined },
        expectModel: m => expect(m.configuration.placement.width).toEqual(DEFAULT_DIVIDER_WIDTH),
        expectCss: expectFullWidth,
      },
      {
        name: "invalid calc() → DEFAULT_DIVIDER_WIDTH",
        patch: { width: "calc(100% - 12px)" },
        expectModel: m => expect(m.configuration.placement.width).toEqual(DEFAULT_DIVIDER_WIDTH),
        expectCss: expectFullWidth,
      },
    ],
  },

  align: {
    cases: [
      {
        name: "left → flex-start",
        patch: { align: "left", width: "50%" },
        expectModel: m => expect(m.configuration.placement.align).toBe("left"),
        expectCss: el => expect(el.style.alignSelf).toBe("flex-start"),
      },
      {
        name: "center → center",
        patch: { align: "center", width: "50%" },
        expectModel: m => expect(m.configuration.placement.align).toBe("center"),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
      {
        name: "right → flex-end",
        patch: { align: "right", width: "50%" },
        expectModel: m => expect(m.configuration.placement.align).toBe("right"),
        expectCss: el => expect(el.style.alignSelf).toBe("flex-end"),
      },
      {
        name: "omitted → DEFAULT_HORIZONTAL_ALIGN (center)",
        patch: { align: undefined, width: "50%" },
        expectModel: m => expect(m.configuration.placement.align).toBe(DEFAULT_HORIZONTAL_ALIGN),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
      {
        name: "invalid → center",
        patch: { align: "diagonal", width: "50%" },
        expectModel: m => expect(m.configuration.placement.align).toBe("center"),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
      {
        name: "ignored on a full width: the divider stretches",
        patch: { align: "left" },
        expectCss: el => expect(el.style.alignSelf).toBe("stretch"),
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

const spec: ComponentMatrixSpec<MessageDividerPayload, MessageDividerModel> = {
  label: "Divider",
  buildPayload: (patch, message) => componentMessage({ type: "divider", color: ["#808080FF"], width: "100%", ...patch }, message),
  select: message => selectFirstChild<MessageDividerModel>(message, "divider"),
  props,
};

runComponentMatrix(spec);
