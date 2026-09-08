/* eslint-env jest */

import type { MessageLabelModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_MAX_LINES,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageLabelPayload } from "com.batch.dom/render/model/types";
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

const box = (value: number): string => `${value}px ${value}px ${value}px ${value}px`;

const FALLBACK_BOX_CSS = box(DEFAULT_BOX_FALLBACK);
const FALLBACK_COLOR_CSS = { light: "rgba(0,0,0,1.000)", dark: "rgba(255,255,255,1.000)" };

const FALLBACK_BOX_MODEL = [DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK];

const props: PropMatrix<MessageLabelPayload, MessageLabelModel> = {
  margin: {
    cases: [
      {
        name: "explicit",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([8, 16, 4, 12]),
        expectCss: el => {
          expect(el.style.margin).toBe("");
          expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" });
        },
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
        expectModel: m => expect(m.configuration.placement.margin).toEqual(FALLBACK_BOX_MODEL),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: FALLBACK_BOX_CSS }),
      },
      {
        name: "invalid → DEFAULT_BOX_FALLBACK box",
        patch: { margin: "wide" },
        expectModel: m => expect(m.configuration.placement.margin).toEqual(FALLBACK_BOX_MODEL),
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
      {
        name: "invalid → undefined (mirrors base)",
        patch: { margin: [8, 16, 4, 12], marginDesktop: "wide" },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
    ],
  },

  textAlign: {
    cases: [
      {
        name: "left",
        patch: { textAlign: "left" },
        expectModel: m => expect(m.configuration.style.align).toBe("left"),
        expectCss: el => expect(el.style.textAlign).toBe("left"),
      },
      {
        name: "center",
        patch: { textAlign: "center" },
        expectModel: m => expect(m.configuration.style.align).toBe("center"),
        expectCss: el => expect(el.style.textAlign).toBe("center"),
      },
      {
        name: "right",
        patch: { textAlign: "right" },
        expectModel: m => expect(m.configuration.style.align).toBe("right"),
        expectCss: el => expect(el.style.textAlign).toBe("right"),
      },
      {
        name: "omitted → DEFAULT_TEXT_ALIGN (center)",
        patch: {},
        expectModel: m => expect(m.configuration.style.align).toBe(DEFAULT_TEXT_ALIGN),
        expectCss: el => expect(el.style.textAlign).toBe(DEFAULT_TEXT_ALIGN),
      },
      {
        name: "invalid → center",
        patch: { textAlign: "diagonal" },
        expectModel: m => expect(m.configuration.style.align).toBe("center"),
        expectCss: el => expect(el.style.textAlign).toBe("center"),
      },
    ],
  },

  fontSize: {
    cases: [
      {
        name: "explicit",
        patch: { fontSize: 20 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(20),
        expectCss: el => {
          expect(el.style.fontSize).toBe("");
          expectResponsivePair(el, "iam-font-size", { base: "20px" });
        },
      },
      {
        name: "omitted → DEFAULT_FONT_SIZE",
        patch: { fontSize: undefined },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FONT_SIZE),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: `${DEFAULT_FONT_SIZE}px` }),
      },
      {
        name: "floored to integer",
        patch: { fontSize: 14.9 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(14),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: "14px" }),
      },
      {
        name: "negative → DEFAULT_FONT_SIZE",
        patch: { fontSize: -4 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FONT_SIZE),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: `${DEFAULT_FONT_SIZE}px` }),
      },
      {
        name: "invalid → DEFAULT_FONT_SIZE",
        patch: { fontSize: "big" },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FONT_SIZE),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: `${DEFAULT_FONT_SIZE}px` }),
      },
    ],
  },

  fontSizeDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { fontSize: 14, fontSizeDesktop: 28 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBe(28),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: "14px", desktop: "28px" }),
      },
      {
        name: "omitted → desktop mirrors base",
        patch: { fontSize: 14 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: "14px" }),
      },
      {
        name: "floored to integer",
        patch: { fontSize: 14, fontSizeDesktop: 27.8 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBe(27),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: "14px", desktop: "27px" }),
      },
      {
        name: "invalid → undefined (mirrors base)",
        patch: { fontSize: 14, fontSizeDesktop: "huge" },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-font-size", { base: "14px" }),
      },
    ],
  },

  color: {
    cases: [
      {
        name: "light+dark pair",
        patch: { color: ["#FF0000FF", "#0000FFFF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#FF0000FF", "#0000FFFF"]),
        expectCss: el => expectThemePair(el, "iam-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,0,255,1.000)" }),
      },
      {
        name: "single → expanded to a mirrored pair",
        patch: { color: ["#ABCDEFFF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#ABCDEFFF", "#ABCDEFFF"]),
        expectCss: el => expectThemePair(el, "iam-color", { light: "rgba(171,205,239,1.000)" }),
      },
      {
        name: "#RRGGBB (no alpha) passes through",
        patch: { color: ["#00FF00"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#00FF00", "#00FF00"]),
        expectCss: el => expectThemePair(el, "iam-color", { light: "#00FF00" }),
      },
      {
        name: "alpha channel → rgba fraction (3 decimals)",
        patch: { color: ["#00000080"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#00000080", "#00000080"]),
        expectCss: el => expectThemePair(el, "iam-color", { light: "rgba(0,0,0,0.502)" }),
      },
      {
        name: "omitted → DEFAULT_FALLBACK_COLOR",
        patch: { color: undefined },
        expectModel: m => expect(m.configuration.style.color).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(el, "iam-color", FALLBACK_COLOR_CSS),
      },
      {
        name: "invalid → DEFAULT_FALLBACK_COLOR",
        patch: { color: ["red"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(el, "iam-color", FALLBACK_COLOR_CSS),
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
          expect(el.style.overflow).toBe("visible");
          expect(el.style.textOverflow).toBe("clip");
          expect(el.style.whiteSpace).toBe("normal");
        },
      },
      {
        name: "1 → single-line ellipsis",
        patch: { maxLines: 1 },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(1),
        expectCss: el => {
          expect(el.style.overflow).toBe("hidden");
          expect(el.style.textOverflow).toBe("ellipsis");
          expect(el.style.whiteSpace).toBe("nowrap");
        },
      },
      {
        name: "3 → webkit line clamp",
        patch: { maxLines: 3 },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(3),
        expectCss: el => {
          expect(el.style.display).toBe("-webkit-box");
          expect(el.style.webkitLineClamp).toBe("3");
        },
      },
      {
        name: "omitted → DEFAULT_TEXT_MAX_LINES",
        patch: {},
        expectModel: m => expect(m.configuration.style.maxLines).toBe(DEFAULT_TEXT_MAX_LINES),
        expectCss: el => {
          expect(el.style.overflow).toBe("visible");
          expect(el.style.textOverflow).toBe("clip");
          expect(el.style.whiteSpace).toBe("normal");
        },
      },
      {
        name: "invalid → DEFAULT_TEXT_MAX_LINES",
        patch: { maxLines: "lots" },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(DEFAULT_TEXT_MAX_LINES),
        expectCss: el => {
          expect(el.style.overflow).toBe("visible");
          expect(el.style.textOverflow).toBe("clip");
          expect(el.style.whiteSpace).toBe("normal");
        },
      },
      {
        name: "negative kept in the model, renders as no truncation",
        patch: { maxLines: -3 },
        expectModel: m => expect(m.configuration.style.maxLines).toBe(-3),
        expectCss: el => {
          expect(el.style.overflow).toBe("visible");
          expect(el.style.whiteSpace).toBe("normal");
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
        expectCss: el => expect(el.style.fontWeight).toBe("700"),
      },
      {
        name: "italic",
        patch: { fontDecoration: ["italic"] },
        expectModel: m => expect(m.configuration.fontStyle.fontDecoration).toContain("italic"),
        expectCss: el => expect(el.style.fontStyle).toBe("italic"),
      },
      {
        name: "underline",
        patch: { fontDecoration: ["underline"] },
        expectCss: el => expect(el.style.textDecoration).toContain("underline"),
      },
      {
        name: "stroke → line-through",
        patch: { fontDecoration: ["stroke"] },
        expectCss: el => expect(el.style.textDecoration).toContain("line-through"),
      },
      {
        name: "invalid entries dropped",
        patch: { fontDecoration: ["bold", "slanted"] },
        expectModel: m => expect(m.configuration.fontStyle.fontDecoration).toEqual(["bold"]),
        expectCss: el => {
          expect(el.style.fontWeight).toBe("700");
          expect(el.style.textDecoration).toBe("none");
        },
      },
      {
        name: "omitted → 400 / none",
        patch: {},
        expectModel: m => expect(m.configuration.fontStyle.fontDecoration).toEqual([]),
        expectCss: el => {
          expect(el.style.fontWeight).toBe("400");
          expect(el.style.fontStyle).toBe("normal");
          expect(el.style.textDecoration).toBe("none");
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

const spec: ComponentMatrixSpec<MessageLabelPayload, MessageLabelModel> = {
  label: "Label",
  buildPayload: (patch, message) =>
    componentMessage(
      { type: "text", id: "title", fontSize: 16, color: ["#000000FF"], ...patch },
      { texts: { title: "Hello" }, ...message }
    ),
  select: message => selectFirstChild<MessageLabelModel>(message, "text"),
  props,
};

runComponentMatrix(spec);

describe("Label · identity", () => {
  const identity: PropCase<MessageLabelModel> = {
    name: "id",
    patch: { id: "title" },
    message: { texts: { title: "Hello World" } },
  };
  const missingRef: PropCase<MessageLabelModel> = {
    name: "missing text ref",
    patch: { id: "absent" },
    message: { texts: {} },
  };

  test("id drives contentRef and label text", () => {
    const model = normalizeCase(spec, identity);
    expect(model.id).toBe("title");
    expect(model.configuration.contentRef).toBe("title");

    const el = renderCase(spec, identity);
    expect(el.className).toBe("iam-text");
    expect(el.textContent).toBe("Hello World");
  });

  test("missing text ref → empty string", () => {
    expect(renderCase(spec, missingRef).textContent).toBe("");
  });
});
