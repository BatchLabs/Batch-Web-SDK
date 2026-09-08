/* eslint-env jest */

import type { MessageButtonModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_BUTTON_BORDER_WIDTH,
  DEFAULT_BUTTON_RADIUS,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_HORIZONTAL_ALIGN,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_MAX_LINES,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageButtonPayload } from "com.batch.dom/render/model/types";
import type { ComponentMatrixSpec, PropCase, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import {
  componentMessage,
  expectResponsivePair,
  expectThemePair,
  normalizeCase,
  renderCase,
  runComponentMatrix,
  selectFirstChild,
} from "com.batch.dom/render/test-utils/prop-matrix";

const label = (el: HTMLElement): HTMLElement => el.querySelector(".iam-button-label") as HTMLElement;

const box = (value: number): string => `${value}px ${value}px ${value}px ${value}px`;

const FALLBACK_BOX_CSS = box(DEFAULT_BOX_FALLBACK);
const TRANSPARENT_CSS = "rgba(0,0,0,0.000)";
const FALLBACK_COLOR_CSS = { light: "rgba(0,0,0,1.000)", dark: "rgba(255,255,255,1.000)" };

const props: PropMatrix<MessageButtonPayload, MessageButtonModel> = {
  margin: {
    cases: [
      {
        name: "explicit",
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
        name: "omitted → undefined (mirrors base)",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
    ],
  },

  padding: {
    cases: [
      {
        name: "explicit",
        patch: { padding: [6, 10, 6, 10] },
        expectModel: m => expect(m.configuration.placement.padding).toEqual([6, 10, 6, 10]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "6px 10px 6px 10px" }),
      },
      {
        name: "omitted → DEFAULT_BOX_FALLBACK box",
        patch: {},
        expectModel: m =>
          expect(m.configuration.placement.padding).toEqual([
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
            DEFAULT_BOX_FALLBACK,
          ]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: FALLBACK_BOX_CSS }),
      },
      {
        name: "negative values accepted (acceptNegativeValue)",
        patch: { padding: [-4] },
        expectModel: m => expect(m.configuration.placement.padding).toEqual([-4, -4, -4, -4]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: box(-4) }),
      },
    ],
  },

  paddingDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { padding: [6, 10, 6, 10], paddingDesktop: [12, 20, 12, 20] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toEqual([12, 20, 12, 20]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "6px 10px 6px 10px", desktop: "12px 20px 12px 20px" }),
      },
      {
        name: "omitted → undefined (mirrors base)",
        patch: { padding: [6, 10, 6, 10] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "6px 10px 6px 10px" }),
      },
      {
        name: "negative values accepted (acceptNegativeValue)",
        patch: { paddingDesktop: [-2] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toEqual([-2, -2, -2, -2]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: FALLBACK_BOX_CSS, desktop: box(-2) }),
      },
    ],
  },

  width: {
    cases: [
      {
        name: "fill → stretch inside the margin box",
        patch: { width: "fill" },
        expectModel: m => expect(m.configuration.placement.width).toBe("fill"),
        expectCss: el => {
          expect(el.style.width).toBe("");
          expect(el.style.alignSelf).toBe("stretch");
        },
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
        name: "omitted → DEFAULT_BUTTON_WIDTH (100%) → stretch",
        patch: {},
        expectModel: m => expect(m.configuration.placement.width).toEqual({ percent: 100 }),
        expectCss: el => {
          expect(el.style.width).toBe("");
          expect(el.style.alignSelf).toBe("stretch");
        },
      },
      {
        name: "invalid calc() → 100% → stretch",
        patch: { width: "calc(100% - 12px)" },
        expectModel: m => expect(m.configuration.placement.width).toEqual({ percent: 100 }),
        expectCss: el => {
          expect(el.style.width).toBe("");
          expect(el.style.alignSelf).toBe("stretch");
        },
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
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
      {
        name: "right → flex-end",
        patch: { align: "right", width: "50%" },
        expectCss: el => expect(el.style.alignSelf).toBe("flex-end"),
      },
      {
        name: "ignored on a full width: the button stretches",
        patch: { align: "left" },
        expectCss: el => expect(el.style.alignSelf).toBe("stretch"),
      },
      {
        name: "omitted → DEFAULT_HORIZONTAL_ALIGN (center)",
        patch: { width: "50%" },
        expectModel: m => expect(m.configuration.placement.align).toBe(DEFAULT_HORIZONTAL_ALIGN),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
      {
        name: "invalid → center",
        patch: { align: "diagonal", width: "50%" },
        expectModel: m => expect(m.configuration.placement.align).toBe("center"),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
    ],
  },

  backgroundColor: {
    cases: [
      {
        name: "explicit",
        patch: { backgroundColor: ["#0044FFFF"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#0044FFFF", "#0044FFFF"]),
        expectCss: el => expectThemePair(el, "iam-bg", { light: "rgba(0,68,255,1.000)" }),
      },
      {
        name: "light+dark pair",
        patch: { backgroundColor: ["#0044FFFF", "#001133FF"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#0044FFFF", "#001133FF"]),
        expectCss: el => expectThemePair(el, "iam-bg", { light: "rgba(0,68,255,1.000)", dark: "rgba(0,17,51,1.000)" }),
      },
      {
        name: "omitted → transparent default",
        patch: { backgroundColor: undefined },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#00000000", "#00000000"]),
        expectCss: el => expectThemePair(el, "iam-bg", { light: TRANSPARENT_CSS }),
      },
      {
        name: "invalid → transparent default",
        patch: { backgroundColor: ["blueish"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#00000000", "#00000000"]),
        expectCss: el => expectThemePair(el, "iam-bg", { light: TRANSPARENT_CSS }),
      },
    ],
  },

  radius: {
    cases: [
      {
        name: "four-value box",
        patch: { radius: [8, 4, 8, 4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual([8, 4, 8, 4]),
        expectCss: el => expect(el.style.borderRadius).toBe("8px 4px 8px 4px"),
      },
      {
        name: "shorthand [8,4] → [8,4,8,4]",
        patch: { radius: [8, 4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual([8, 4, 8, 4]),
        expectCss: el => expect(el.style.borderRadius).toBe("8px 4px 8px 4px"),
      },
      {
        name: "omitted → DEFAULT_BUTTON_RADIUS box",
        patch: {},
        expectModel: m =>
          expect(m.configuration.style.radius).toEqual([
            DEFAULT_BUTTON_RADIUS,
            DEFAULT_BUTTON_RADIUS,
            DEFAULT_BUTTON_RADIUS,
            DEFAULT_BUTTON_RADIUS,
          ]),
        expectCss: el => expect(el.style.borderRadius).toBe(box(DEFAULT_BUTTON_RADIUS)),
      },
      {
        name: "negative → DEFAULT_BUTTON_RADIUS box",
        patch: { radius: [-8] },
        expectModel: m =>
          expect(m.configuration.style.radius).toEqual([
            DEFAULT_BUTTON_RADIUS,
            DEFAULT_BUTTON_RADIUS,
            DEFAULT_BUTTON_RADIUS,
            DEFAULT_BUTTON_RADIUS,
          ]),
        expectCss: el => expect(el.style.borderRadius).toBe(box(DEFAULT_BUTTON_RADIUS)),
      },
    ],
  },

  borderWidth: {
    cases: [
      {
        name: "explicit",
        patch: { borderWidth: 3 },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(3),
        expectCss: el => expect(el.style.borderWidth).toBe("3px"),
      },
      {
        name: "omitted → DEFAULT_BUTTON_BORDER_WIDTH",
        patch: {},
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(DEFAULT_BUTTON_BORDER_WIDTH),
        expectCss: el => expect(el.style.borderWidth).toBe(`${DEFAULT_BUTTON_BORDER_WIDTH}px`),
      },
      {
        name: "negative → default",
        patch: { borderWidth: -1 },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(DEFAULT_BUTTON_BORDER_WIDTH),
        expectCss: el => expect(el.style.borderWidth).toBe(`${DEFAULT_BUTTON_BORDER_WIDTH}px`),
      },
      {
        name: "invalid → default",
        patch: { borderWidth: "thick" },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(DEFAULT_BUTTON_BORDER_WIDTH),
        expectCss: el => expect(el.style.borderWidth).toBe(`${DEFAULT_BUTTON_BORDER_WIDTH}px`),
      },
    ],
  },

  borderColor: {
    cases: [
      {
        name: "explicit",
        patch: { borderColor: ["#123456FF"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#123456FF", "#123456FF"]),
        expectCss: el => expectThemePair(el, "iam-border-color", { light: "rgba(18,52,86,1.000)" }),
      },
      {
        name: "light+dark pair",
        patch: { borderColor: ["#123456FF", "#654321FF"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#123456FF", "#654321FF"]),
        expectCss: el => expectThemePair(el, "iam-border-color", { light: "rgba(18,52,86,1.000)", dark: "rgba(101,67,33,1.000)" }),
      },
      {
        name: "omitted → transparent default",
        patch: {},
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#00000000", "#00000000"]),
        expectCss: el => expectThemePair(el, "iam-border-color", { light: TRANSPARENT_CSS }),
      },
      {
        name: "invalid → transparent default",
        patch: { borderColor: ["darkish"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#00000000", "#00000000"]),
        expectCss: el => expectThemePair(el, "iam-border-color", { light: TRANSPARENT_CSS }),
      },
    ],
  },

  fontSize: {
    cases: [
      {
        name: "explicit",
        patch: { fontSize: 20 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(20),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: "20px" }),
      },
      {
        name: "omitted → DEFAULT_FONT_SIZE",
        patch: { fontSize: undefined },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FONT_SIZE),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: `${DEFAULT_FONT_SIZE}px` }),
      },
      {
        name: "floored to integer",
        patch: { fontSize: 14.9 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(14),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: "14px" }),
      },
      {
        name: "negative → DEFAULT_FONT_SIZE",
        patch: { fontSize: -4 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FONT_SIZE),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: `${DEFAULT_FONT_SIZE}px` }),
      },
      {
        name: "invalid → DEFAULT_FONT_SIZE",
        patch: { fontSize: "big" },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FONT_SIZE),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: `${DEFAULT_FONT_SIZE}px` }),
      },
    ],
  },

  fontSizeDesktop: {
    cases: [
      {
        name: "explicit",
        patch: { fontSize: 14, fontSizeDesktop: 28 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBe(28),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: "14px", desktop: "28px" }),
      },
      {
        name: "omitted → desktop mirrors base",
        patch: { fontSize: 14 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: "14px" }),
      },
      {
        name: "invalid → undefined (mirrors base)",
        patch: { fontSize: 14, fontSizeDesktop: "huge" },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(label(el), "iam-font-size", { base: "14px" }),
      },
    ],
  },

  textAlign: {
    cases: [
      {
        name: "left",
        patch: { textAlign: "left" },
        expectModel: m => expect(m.configuration.style.align).toBe("left"),
        expectCss: el => {
          expect(el.style.textAlign).toBe("left");
          expect(label(el).style.textAlign).toBe("left");
        },
      },
      {
        name: "right",
        patch: { textAlign: "right" },
        expectModel: m => expect(m.configuration.style.align).toBe("right"),
        expectCss: el => {
          expect(el.style.textAlign).toBe("right");
          expect(label(el).style.textAlign).toBe("right");
        },
      },
      {
        name: "omitted → DEFAULT_TEXT_ALIGN (center)",
        patch: {},
        expectModel: m => expect(m.configuration.style.align).toBe(DEFAULT_TEXT_ALIGN),
        expectCss: el => {
          expect(el.style.textAlign).toBe(DEFAULT_TEXT_ALIGN);
          expect(label(el).style.textAlign).toBe(DEFAULT_TEXT_ALIGN);
        },
      },
      {
        name: "invalid → center",
        patch: { textAlign: "diagonal" },
        expectModel: m => expect(m.configuration.style.align).toBe("center"),
        expectCss: el => {
          expect(el.style.textAlign).toBe("center");
          expect(label(el).style.textAlign).toBe("center");
        },
      },
    ],
  },

  textColor: {
    cases: [
      {
        name: "light+dark pair",
        patch: { textColor: ["#FF0000FF", "#00FF00FF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el => {
          expectThemePair(label(el), "iam-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" });
          expectThemePair(el, "iam-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" });
        },
      },
      {
        name: "single → dark mirrors light",
        patch: { textColor: ["#ABCDEFFF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#ABCDEFFF", "#ABCDEFFF"]),
        expectCss: el => expectThemePair(label(el), "iam-color", { light: "rgba(171,205,239,1.000)" }),
      },
      {
        name: "omitted → DEFAULT_FALLBACK_COLOR",
        patch: { textColor: undefined },
        expectModel: m => expect(m.configuration.style.color).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => {
          expectThemePair(label(el), "iam-color", FALLBACK_COLOR_CSS);
          expectThemePair(el, "iam-color", FALLBACK_COLOR_CSS);
        },
      },
      {
        name: "invalid → DEFAULT_FALLBACK_COLOR",
        patch: { textColor: ["red"] },
        expectModel: m => expect(m.configuration.style.color[0]).toBe(DEFAULT_FALLBACK_COLOR[0]),
        expectCss: el => expectThemePair(label(el), "iam-color", FALLBACK_COLOR_CSS),
      },
    ],
  },

  maxLines: {
    cases: [
      {
        name: "0 → no truncation",
        patch: { maxLines: 0 },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(0),
        expectCss: el => {
          expect(label(el).style.overflow).toBe("visible");
          expect(label(el).style.textOverflow).toBe("clip");
          expect(label(el).style.whiteSpace).toBe("normal");
        },
      },
      {
        name: "1 → single-line ellipsis",
        patch: { maxLines: 1 },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(1),
        expectCss: el => {
          expect(label(el).style.textOverflow).toBe("ellipsis");
          expect(label(el).style.whiteSpace).toBe("nowrap");
        },
      },
      {
        name: "3 → webkit line clamp",
        patch: { maxLines: 3 },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(3),
        expectCss: el => {
          expect(label(el).style.display).toBe("-webkit-box");
          expect(label(el).style.webkitLineClamp).toBe("3");
        },
      },
      {
        name: "omitted → DEFAULT_TEXT_MAX_LINES",
        patch: {},
        expectModel: m => expect(m.configuration.style.maxLines).toBe(DEFAULT_TEXT_MAX_LINES),
        expectCss: el => {
          expect(label(el).style.overflow).toBe("visible");
          expect(label(el).style.whiteSpace).toBe("normal");
        },
      },
      {
        name: "invalid → DEFAULT_TEXT_MAX_LINES",
        patch: { maxLines: "lots" },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(DEFAULT_TEXT_MAX_LINES),
        expectCss: el => {
          expect(label(el).style.overflow).toBe("visible");
          expect(label(el).style.whiteSpace).toBe("normal");
        },
      },
    ],
  },

  fontDecoration: {
    cases: [
      {
        name: "bold → 700",
        patch: { fontDecoration: ["bold"] },
        expectModel: m => expect(m.configuration.fontStyle.fontDecoration).toContain("bold"),
        expectCss: el => expect(label(el).style.fontWeight).toBe("700"),
      },
      {
        name: "italic",
        patch: { fontDecoration: ["italic"] },
        expectModel: m => expect(m.configuration.fontStyle.fontDecoration).toContain("italic"),
        expectCss: el => expect(label(el).style.fontStyle).toBe("italic"),
      },
      {
        name: "underline",
        patch: { fontDecoration: ["underline"] },
        expectCss: el => expect(label(el).style.textDecoration).toContain("underline"),
      },
      {
        name: "stroke → line-through",
        patch: { fontDecoration: ["stroke"] },
        expectCss: el => expect(label(el).style.textDecoration).toContain("line-through"),
      },
      {
        name: "invalid entries dropped",
        patch: { fontDecoration: ["bold", "slanted"] },
        expectModel: m => expect(m.configuration.fontStyle.fontDecoration).toEqual(["bold"]),
        expectCss: el => {
          expect(label(el).style.fontWeight).toBe("700");
          expect(label(el).style.textDecoration).toBe("none");
        },
      },
      {
        name: "omitted → 400 / none",
        patch: {},
        expectModel: m => expect(m.configuration.fontStyle.fontDecoration).toEqual([]),
        expectCss: el => {
          expect(label(el).style.fontWeight).toBe("400");
          expect(label(el).style.fontStyle).toBe("normal");
          expect(label(el).style.textDecoration).toBe("none");
        },
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

const spec: ComponentMatrixSpec<MessageButtonPayload, MessageButtonModel> = {
  label: "Button",
  buildPayload: (patch, message) =>
    componentMessage(
      { type: "button", id: "cta", backgroundColor: ["#0044FFFF"], textColor: ["#FFFFFFFF"], fontSize: 14, ...patch },
      { texts: { cta: "Click" }, ...message }
    ),
  select: message => selectFirstChild<MessageButtonModel>(message, "button"),
  props,
};

runComponentMatrix(spec);

describe("Button · identity", () => {
  const identity: PropCase<MessageButtonModel> = {
    name: "id",
    patch: { id: "cta" },
    message: { texts: { cta: "Click me" } },
  };

  test("id drives contentRef, actionRef and label text", () => {
    const model = normalizeCase(spec, identity);
    expect(model.id).toBe("cta");
    expect(model.configuration.contentRef).toBe("cta");
    expect(model.configuration.actionRef).toBe("cta");
    expect(label(renderCase(spec, identity)).textContent).toBe("Click me");
  });
});
