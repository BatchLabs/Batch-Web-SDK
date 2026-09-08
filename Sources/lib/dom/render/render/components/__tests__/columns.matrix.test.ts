/* eslint-env jest */

import type { MessageColumnsModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_COLUMNS_SPACING,
  DEFAULT_CONTENT_ALIGN,
  DEFAULT_LAYOUT_RADIUS,
  DEFAULT_TRANSPARENT_COLOR,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageColumnsPayload } from "com.batch.dom/render/model/types";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import {
  componentMessage,
  expectResponsivePair,
  expectThemePair,
  renderCase,
  runComponentMatrix,
  selectFirstChild,
} from "com.batch.dom/render/test-utils/prop-matrix";

const columnEls = (el: HTMLElement): HTMLElement[] =>
  Array.from(el.children).filter((c): c is HTMLElement => c.classList.contains("iam-column"));

const twoButtons = [
  { type: "button", id: "b1" },
  { type: "button", id: "b2" },
];
const twoButtonTexts = { texts: { b1: "One", b2: "Two" } };

const TRANSPARENT_CSS = { light: "rgba(0,0,0,0.000)" };
const FALLBACK_BOX_CSS = "0px 0px 0px 0px";
const FALLBACK_BOX_MODEL = [DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK];
const FALLBACK_RADIUS_MODEL = [DEFAULT_LAYOUT_RADIUS, DEFAULT_LAYOUT_RADIUS, DEFAULT_LAYOUT_RADIUS, DEFAULT_LAYOUT_RADIUS];
const FALLBACK_RADIUS_CSS = `${DEFAULT_LAYOUT_RADIUS}px ${DEFAULT_LAYOUT_RADIUS}px ${DEFAULT_LAYOUT_RADIUS}px ${DEFAULT_LAYOUT_RADIUS}px`;

const expectEqualHalves = (el: HTMLElement): void => {
  const cols = columnEls(el);
  expect(cols[0].style.flex).toBe("0.5 1 0px");
  expect(cols[1].style.flex).toBe("0.5 1 0px");
};

const props: PropMatrix<MessageColumnsPayload, MessageColumnsModel> = {
  children: {
    cases: [
      {
        name: "a valid child is normalized and rendered inside its column",
        patch: { children: twoButtons },
        message: twoButtonTexts,
        expectModel: m => {
          expect(m.configuration.children.map(c => c?.type)).toEqual(["button", "button"]);
          expect(m.configuration.children.map(c => (c && "id" in c ? c.id : null))).toEqual(["b1", "b2"]);
        },
        expectCss: el => {
          const cols = columnEls(el);
          expect(cols[0].querySelector(".iam-button")?.textContent).toBe("One");
          expect(cols[1].querySelector(".iam-button")?.textContent).toBe("Two");
        },
      },
      {
        name: "count preserved, null slot kept",
        patch: { children: [{ type: "button", id: "b1" }, null] },
        message: { texts: { b1: "One" } },
        expectModel: m => {
          expect(m.configuration.children.length).toBe(2);
          expect(m.configuration.children[0]).not.toBeNull();
          expect(m.configuration.children[1]).toBeNull();
        },
        expectCss: el => {
          const cols = columnEls(el);
          expect(cols.length).toBe(2);
          expect(cols[1].children.length).toBe(0);
        },
      },
      {
        name: "null-only slots normalize to null but keep a column each",
        patch: { children: [null, null] },
        expectModel: m => expect(m.configuration.children).toEqual([null, null]),
        expectCss: el => {
          const cols = columnEls(el);
          expect(cols.length).toBe(2);
          expect(cols.every(c => c.children.length === 0)).toBe(true);
        },
      },
      {
        name: "unknown child type → null slot, empty column kept",
        patch: {
          children: [
            { type: "carousel", id: "c1" },
            { type: "button", id: "b2" },
          ],
        },
        message: { texts: { b2: "Two" } },
        expectModel: m => {
          expect(m.configuration.children[0]).toBeNull();
          expect(m.configuration.children[1]?.type).toBe("button");
        },
        expectCss: el => {
          const cols = columnEls(el);
          expect(cols[0].children.length).toBe(0);
          expect(cols[1].querySelector(".iam-button")).not.toBeNull();
        },
      },
      {
        name: "nested columns child normalized and rendered recursively",
        patch: { children: [{ type: "columns", children: [{ type: "button", id: "b1" }], spacing: 4 }] },
        message: { texts: { b1: "One" } },
        expectModel: m => {
          const nested = m.configuration.children[0];
          expect(nested?.type).toBe("columns");
          expect(nested?.type === "columns" && nested.configuration.style.spacing).toBe(4);
        },
        expectCss: el => {
          const nested = columnEls(el)[0].querySelector<HTMLElement>(".iam-columns");
          expect(nested?.style.gap).toBe("4px");
          expect(nested && columnEls(nested).length).toBe(1);
        },
      },
      {
        name: "child hideOn is applied by the tree, not by renderColumns",
        patch: { children: [{ type: "button", id: "b1", hideOn: "mobile" }] },
        message: { texts: { b1: "One" } },
        expectModel: m => {
          const child = m.configuration.children[0];
          expect(child && "hideOn" in child ? child.hideOn : undefined).toBe("mobile");
        },
        expectCss: el => expect(columnEls(el)[0].querySelector(".iam-button")?.className).toContain("iam-hide-mobile"),
      },
      {
        name: "omitted → no children, no column",
        patch: { children: undefined },
        expectModel: m => expect(m.configuration.children).toEqual([]),
        expectCss: el => expect(columnEls(el).length).toBe(0),
      },
    ],
  },

  ratios: {
    cases: [
      {
        name: "absolute [50,50] preserved",
        patch: { children: twoButtons, ratios: [50, 50] },
        message: twoButtonTexts,
        expectModel: m => expect(m.configuration.ratios).toEqual([50, 50]),
        expectCss: expectEqualHalves,
      },
      {
        name: "relative [1,3] → fractional flex weights",
        patch: { children: twoButtons, ratios: [1, 3] },
        message: twoButtonTexts,
        expectModel: m => expect(m.configuration.ratios).toEqual([1, 3]),
        expectCss: el => {
          const cols = columnEls(el);
          expect(cols[0].style.flex).toBe("0.25 1 0px");
          expect(cols[1].style.flex).toBe("0.75 1 0px");
        },
      },
      {
        name: "non-positive value → equal distribution",
        patch: { children: twoButtons, ratios: [0, 100] },
        message: twoButtonTexts,
        expectModel: m => expect(m.configuration.ratios).toEqual([50, 50]),
        expectCss: expectEqualHalves,
      },
      {
        name: "length mismatch → equal distribution",
        patch: { children: twoButtons, ratios: [1, 2, 3] },
        message: twoButtonTexts,
        expectModel: m => expect(m.configuration.ratios).toEqual([50, 50]),
        expectCss: expectEqualHalves,
      },
      {
        name: "omitted → equal distribution",
        patch: { children: twoButtons },
        message: twoButtonTexts,
        expectModel: m => expect(m.configuration.ratios).toEqual([50, 50]),
        expectCss: expectEqualHalves,
      },
      {
        name: "omitted, single child → [100]",
        patch: { children: [{ type: "button", id: "b1" }] },
        message: { texts: { b1: "One" } },
        expectModel: m => expect(m.configuration.ratios).toEqual([100]),
        expectCss: el => expect(columnEls(el)[0].style.flex).toBe("1 1 0px"),
      },
      {
        name: "omitted, three children → floor+remainder [33,33,34]",
        patch: {
          children: [
            { type: "button", id: "b1" },
            { type: "button", id: "b2" },
            { type: "button", id: "b3" },
          ],
        },
        message: { texts: { b1: "1", b2: "2", b3: "3" } },
        expectModel: m => expect(m.configuration.ratios).toEqual([33, 33, 34]),
        expectCss: el => expect(columnEls(el).map(c => c.style.flex)).toEqual(["0.33 1 0px", "0.33 1 0px", "0.34 1 0px"]),
      },
      {
        name: "no children → empty ratios",
        patch: { children: [] },
        expectModel: m => expect(m.configuration.ratios).toEqual([]),
        expectCss: el => expect(columnEls(el).length).toBe(0),
      },
    ],
  },

  spacing: {
    cases: [
      {
        name: "explicit → CSS gap",
        patch: { spacing: 16 },
        expectModel: m => expect(m.configuration.style.spacing).toBe(16),
        expectCss: el => expect(el.style.gap).toBe("16px"),
      },
      {
        name: "omitted → DEFAULT_COLUMNS_SPACING, no gap",
        patch: {},
        expectModel: m => expect(m.configuration.style.spacing).toBe(DEFAULT_COLUMNS_SPACING),
        expectCss: el => expect(el.style.gap).toBe(""),
      },
      {
        name: "0 → no gap stamped",
        patch: { spacing: 0 },
        expectModel: m => expect(m.configuration.style.spacing).toBe(0),
        expectCss: el => expect(el.style.gap).toBe(""),
      },
      {
        name: "negative → default 0, no gap",
        patch: { spacing: -8 },
        expectModel: m => expect(m.configuration.style.spacing).toBe(DEFAULT_COLUMNS_SPACING),
        expectCss: el => expect(el.style.gap).toBe(""),
      },
      {
        name: "floored to integer",
        patch: { spacing: 12.9 },
        expectModel: m => expect(m.configuration.style.spacing).toBe(12),
        expectCss: el => expect(el.style.gap).toBe("12px"),
      },
      {
        name: "invalid → default 0, no gap",
        patch: { spacing: "wide" },
        expectModel: m => expect(m.configuration.style.spacing).toBe(DEFAULT_COLUMNS_SPACING),
        expectCss: el => expect(el.style.gap).toBe(""),
      },
    ],
  },

  contentAlign: {
    cases: [
      {
        name: "top → flex-start",
        patch: { contentAlign: "top" },
        expectModel: m => expect(m.configuration.style.contentAlign).toBe("top"),
        expectCss: el => expect(el.style.alignItems).toBe("flex-start"),
      },
      {
        name: "center → center",
        patch: { contentAlign: "center" },
        expectModel: m => expect(m.configuration.style.contentAlign).toBe("center"),
        expectCss: el => expect(el.style.alignItems).toBe("center"),
      },
      {
        name: "bottom → flex-end",
        patch: { contentAlign: "bottom" },
        expectModel: m => expect(m.configuration.style.contentAlign).toBe("bottom"),
        expectCss: el => expect(el.style.alignItems).toBe("flex-end"),
      },
      {
        name: "omitted → DEFAULT_CONTENT_ALIGN (center)",
        patch: {},
        expectModel: m => expect(m.configuration.style.contentAlign).toBe(DEFAULT_CONTENT_ALIGN),
        expectCss: el => expect(el.style.alignItems).toBe("center"),
      },
      {
        name: "invalid → default center",
        patch: { contentAlign: "sideways" },
        expectModel: m => expect(m.configuration.style.contentAlign).toBe(DEFAULT_CONTENT_ALIGN),
        expectCss: el => expect(el.style.alignItems).toBe("center"),
      },
    ],
  },

  margin: {
    cases: [
      {
        name: "explicit → var pair mirrors base",
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
        expectModel: m => expect(m.configuration.placement.margin).toEqual(FALLBACK_BOX_MODEL),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: FALLBACK_BOX_CSS }),
      },
      {
        name: "invalid → DEFAULT_BOX_FALLBACK box",
        patch: { margin: ["8", "16"] },
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
        name: "omitted → model undefined, -desktop mirrors base",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
      {
        name: "invalid → model undefined, -desktop mirrors base",
        patch: { margin: [8, 16, 4, 12], marginDesktop: [] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
    ],
  },

  padding: {
    cases: [
      {
        name: "explicit → var pair mirrors base",
        patch: { padding: [6, 10, 6, 10] },
        expectModel: m => expect(m.configuration.placement.padding).toEqual([6, 10, 6, 10]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "6px 10px 6px 10px" }),
      },
      {
        name: "negative values accepted (acceptNegativeValue)",
        patch: { padding: [-4, 0, -4, 0] },
        expectModel: m => expect(m.configuration.placement.padding).toEqual([-4, 0, -4, 0]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "-4px 0px -4px 0px" }),
      },
      {
        name: "omitted → DEFAULT_BOX_FALLBACK box",
        patch: {},
        expectModel: m => expect(m.configuration.placement.padding).toEqual(FALLBACK_BOX_MODEL),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: FALLBACK_BOX_CSS }),
      },
      {
        name: "invalid → DEFAULT_BOX_FALLBACK box",
        patch: { padding: ["6", "10"] },
        expectModel: m => expect(m.configuration.placement.padding).toEqual(FALLBACK_BOX_MODEL),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: FALLBACK_BOX_CSS }),
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
        name: "negative values accepted, like the base padding",
        patch: { padding: [0, 0, 0, 0], paddingDesktop: [-8, 0, -8, 0] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toEqual([-8, 0, -8, 0]),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "0px 0px 0px 0px", desktop: "-8px 0px -8px 0px" }),
      },
      {
        name: "omitted → model undefined, -desktop mirrors base",
        patch: { padding: [6, 10, 6, 10] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "6px 10px 6px 10px" }),
      },
      {
        name: "invalid → model undefined, -desktop mirrors base",
        patch: { padding: [6, 10, 6, 10], paddingDesktop: [] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-padding", { base: "6px 10px 6px 10px" }),
      },
    ],
  },

  backgroundColor: {
    cases: [
      {
        name: "explicit pair",
        patch: { backgroundColor: ["#FF0000FF", "#00FF00FF"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el => expectThemePair(el, "iam-bg", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" }),
      },
      {
        name: "single → dark mirrors light",
        patch: { backgroundColor: ["#ABCDEFFF"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#ABCDEFFF", "#ABCDEFFF"]),
        expectCss: el => expectThemePair(el, "iam-bg", { light: "rgba(171,205,239,1.000)" }),
      },
      {
        name: "omitted → DEFAULT_TRANSPARENT_COLOR",
        patch: {},
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(DEFAULT_TRANSPARENT_COLOR),
        expectCss: el => expectThemePair(el, "iam-bg", TRANSPARENT_CSS),
      },
      {
        name: "invalid → DEFAULT_TRANSPARENT_COLOR",
        patch: { backgroundColor: ["nope"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(DEFAULT_TRANSPARENT_COLOR),
        expectCss: el => expectThemePair(el, "iam-bg", TRANSPARENT_CSS),
      },
    ],
  },

  radius: {
    cases: [
      {
        name: "four-value box",
        patch: { radius: [12, 8, 12, 8] },
        expectModel: m => expect(m.configuration.style.radius).toEqual([12, 8, 12, 8]),
        expectCss: el => expect(el.style.borderRadius).toBe("12px 8px 12px 8px"),
      },
      {
        name: "omitted → DEFAULT_LAYOUT_RADIUS box",
        patch: {},
        expectModel: m => expect(m.configuration.style.radius).toEqual(FALLBACK_RADIUS_MODEL),
        expectCss: el => expect(el.style.borderRadius).toBe(FALLBACK_RADIUS_CSS),
      },
      {
        name: "negative → DEFAULT_LAYOUT_RADIUS box",
        patch: { radius: [-4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual(FALLBACK_RADIUS_MODEL),
        expectCss: el => expect(el.style.borderRadius).toBe(FALLBACK_RADIUS_CSS),
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

const spec: ComponentMatrixSpec<MessageColumnsPayload, MessageColumnsModel> = {
  label: "Columns",
  buildPayload: (patch, message) => componentMessage({ type: "columns", children: [], ...patch }, message),
  select: message => selectFirstChild<MessageColumnsModel>(message, "columns"),
  props,
};

runComponentMatrix(spec);

describe("Columns · container invariants", () => {
  test("container is a flex row", () => {
    const el = renderCase(spec, { name: "container" });
    expect(el.classList.contains("iam-columns")).toBe(true);
    expect(el.style.display).toBe("flex");
    expect(el.style.flexDirection).toBe("row");
  });

  test("each column slot cannot shrink below its content", () => {
    const el = renderCase(spec, { name: "column min-width", patch: { children: twoButtons }, message: twoButtonTexts });
    expect(columnEls(el).map(c => c.style.minWidth)).toEqual(["0", "0"]);
  });
});
