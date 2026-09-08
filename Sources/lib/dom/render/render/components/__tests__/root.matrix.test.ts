/* eslint-env jest */

import type { MessageModel, MessageRootModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_ROOT_BACKGROUND_COLOR,
  DEFAULT_ROOT_BORDER_WIDTH,
  DEFAULT_ROOT_RADIUS,
  DEFAULT_TRANSPARENT_COLOR,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessagePayload, MessageRootContainerPayload } from "com.batch.dom/render/model/types";
import { applyRootConfigurationStyles } from "com.batch.dom/render/runtime/surface/root-configuration";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { componentMessage, expectResponsivePair, expectThemePair, runComponentMatrix } from "com.batch.dom/render/test-utils/prop-matrix";

const FULLSCREEN: Partial<MessagePayload> = { format: "fullscreen" };

const DEFAULT_BACKGROUND_CSS = { light: "rgba(255,255,255,1.000)", dark: "rgba(0,0,0,1.000)" };
const TRANSPARENT_CSS = { light: "rgba(0,0,0,0.000)" };
const DEFAULT_MARGIN_BOX = [DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK];
const DEFAULT_RADIUS_BOX = [DEFAULT_ROOT_RADIUS, DEFAULT_ROOT_RADIUS, DEFAULT_ROOT_RADIUS, DEFAULT_ROOT_RADIUS];

const props: PropMatrix<MessageRootContainerPayload, MessageRootModel> = {
  children: {
    cssExpression: "none",
    cases: [
      {
        name: "children are normalized into the tree",
        patch: {
          children: [
            { type: "spacer", height: "8px" },
            { type: "spacer", height: "16px" },
          ],
        },
        expectModel: m => expect(m.children).toHaveLength(2),
      },
      {
        name: "non-object children are filtered out",
        patch: { children: [null, { type: "spacer", height: "8px" }, "nope"] },
        expectModel: m => expect(m.children).toHaveLength(1),
      },
      {
        name: "a non-array children falls back to an empty tree",
        patch: { children: "nope" },
        expectModel: m => expect(m.children).toEqual([]),
      },
    ],
  },

  backgroundColor: {
    cases: [
      {
        name: "light+dark pair",
        patch: { backgroundColor: ["#112233FF", "#332211FF"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#112233FF", "#332211FF"]),
        expectCss: el => expectThemePair(el, "iam-surface-bg", { light: "rgba(17,34,51,1.000)", dark: "rgba(51,34,17,1.000)" }),
      },
      {
        name: "single → dark mirrors light",
        patch: { backgroundColor: ["#ABCDEFFF"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#ABCDEFFF", "#ABCDEFFF"]),
        expectCss: el => expectThemePair(el, "iam-surface-bg", { light: "rgba(171,205,239,1.000)" }),
      },
      {
        name: "omitted → DEFAULT_ROOT_BACKGROUND_COLOR",
        patch: {},
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(DEFAULT_ROOT_BACKGROUND_COLOR),
        expectCss: el => expectThemePair(el, "iam-surface-bg", DEFAULT_BACKGROUND_CSS),
      },
      {
        name: "invalid → DEFAULT_ROOT_BACKGROUND_COLOR",
        patch: { backgroundColor: ["notacolor"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(DEFAULT_ROOT_BACKGROUND_COLOR),
        expectCss: el => expectThemePair(el, "iam-surface-bg", DEFAULT_BACKGROUND_CSS),
      },
      {
        name: "box: false still stamps the background pair",
        patch: { backgroundColor: ["#112233FF", "#332211FF"] },
        message: FULLSCREEN,
        expectCss: el => expectThemePair(el, "iam-surface-bg", { light: "rgba(17,34,51,1.000)", dark: "rgba(51,34,17,1.000)" }),
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
        name: "omitted → DEFAULT_ROOT_RADIUS box",
        patch: {},
        expectModel: m => expect(m.configuration.style.radius).toEqual(DEFAULT_RADIUS_BOX),
        expectCss: el => expect(el.style.borderRadius).toBe("0px 0px 0px 0px"),
      },
      {
        name: "negative → DEFAULT_ROOT_RADIUS (radius rejects negatives)",
        patch: { radius: [-4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual(DEFAULT_RADIUS_BOX),
        expectCss: el => expect(el.style.borderRadius).toBe("0px 0px 0px 0px"),
      },
      {
        name: "box: false skips the radius",
        patch: { radius: [8, 4, 8, 4] },
        message: FULLSCREEN,
        expectCss: el => expect(el.style.borderRadius).toBe(""),
      },
    ],
  },

  borderWidth: {
    cases: [
      {
        name: "explicit → solid border",
        patch: { borderWidth: 3 },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(3),
        expectCss: el => {
          expect(el.style.borderWidth).toBe("3px");
          expect(el.style.borderStyle).toBe("solid");
        },
      },
      {
        name: "omitted → DEFAULT_ROOT_BORDER_WIDTH (no border stamped)",
        patch: {},
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(DEFAULT_ROOT_BORDER_WIDTH),
        expectCss: el => {
          expect(el.style.borderWidth).toBe("");
          expect(el.style.borderStyle).toBe("");
        },
      },
      {
        name: "negative → DEFAULT_ROOT_BORDER_WIDTH (no border stamped)",
        patch: { borderWidth: -1 },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(DEFAULT_ROOT_BORDER_WIDTH),
        expectCss: el => {
          expect(el.style.borderWidth).toBe("");
          expect(el.style.borderStyle).toBe("");
        },
      },
      {
        name: "box: false skips the border",
        patch: { borderWidth: 3 },
        message: FULLSCREEN,
        expectCss: el => {
          expect(el.style.borderWidth).toBe("");
          expect(el.style.borderStyle).toBe("");
        },
      },
    ],
  },

  borderColor: {
    cases: [
      {
        name: "pair stamped when borderWidth > 0",
        patch: { borderWidth: 2, borderColor: ["#123456FF", "#654321FF"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#123456FF", "#654321FF"]),
        expectCss: el => expectThemePair(el, "iam-surface-border-color", { light: "rgba(18,52,86,1.000)", dark: "rgba(101,67,33,1.000)" }),
      },
      {
        name: "single → dark mirrors light",
        patch: { borderWidth: 2, borderColor: ["#123456FF"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#123456FF", "#123456FF"]),
        expectCss: el => expectThemePair(el, "iam-surface-border-color", { light: "rgba(18,52,86,1.000)" }),
      },
      {
        name: "omitted → DEFAULT_TRANSPARENT_COLOR",
        patch: { borderWidth: 2 },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(DEFAULT_TRANSPARENT_COLOR),
        expectCss: el => expectThemePair(el, "iam-surface-border-color", TRANSPARENT_CSS),
      },
      {
        name: "invalid → DEFAULT_TRANSPARENT_COLOR",
        patch: { borderWidth: 2, borderColor: ["red"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(DEFAULT_TRANSPARENT_COLOR),
        expectCss: el => expectThemePair(el, "iam-surface-border-color", TRANSPARENT_CSS),
      },
      {
        name: "not stamped at the default borderWidth 0",
        patch: { borderColor: ["#123456FF"] },
        expectCss: el => expect(el.style.getPropertyValue("--iam-surface-border-color")).toBe(""),
      },
      {
        name: "box: false skips the border color pair even at borderWidth > 0",
        patch: { borderWidth: 2, borderColor: ["#123456FF"] },
        message: FULLSCREEN,
        expectCss: el => expect(el.style.getPropertyValue("--iam-surface-border-color")).toBe(""),
      },
    ],
  },

  margin: {
    cases: [
      {
        name: "explicit four-value",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([8, 16, 4, 12]),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "8px 16px 4px 12px" }),
      },
      {
        name: "shorthand [10,20] → [10,20,10,20]",
        patch: { margin: [10, 20] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([10, 20, 10, 20]),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "10px 20px 10px 20px" }),
      },
      {
        name: "shorthand [5] → [5,5,5,5]",
        patch: { margin: [5] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([5, 5, 5, 5]),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "5px 5px 5px 5px" }),
      },
      {
        name: "shorthand [1,2,3] → [1,2,3,2]",
        patch: { margin: [1, 2, 3] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([1, 2, 3, 2]),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "1px 2px 3px 2px" }),
      },
      {
        name: "negative allowed (box accepts negatives)",
        patch: { margin: [-4, 0, 0, 0] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([-4, 0, 0, 0]),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "-4px 0px 0px 0px" }),
      },
      {
        name: "omitted → DEFAULT_BOX_FALLBACK box",
        patch: {},
        expectModel: m => expect(m.configuration.placement.margin).toEqual(DEFAULT_MARGIN_BOX),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "0px 0px 0px 0px" }),
      },
      {
        name: "box: false skips the margin pair",
        patch: { margin: [8, 16, 4, 12] },
        message: FULLSCREEN,
        expectCss: el => expect(el.style.getPropertyValue("--iam-root-margin")).toBe(""),
      },
    ],
  },

  marginDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { margin: [8, 8, 8, 8], marginDesktop: [24, 16, 24, 16] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toEqual([24, 16, 24, 16]),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "8px 8px 8px 8px", desktop: "24px 16px 24px 16px" }),
      },
      {
        name: "shorthand [24,16] → [24,16,24,16]",
        patch: { margin: [8, 8, 8, 8], marginDesktop: [24, 16] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toEqual([24, 16, 24, 16]),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "8px 8px 8px 8px", desktop: "24px 16px 24px 16px" }),
      },
      {
        name: "omitted → undefined, desktop mirrors base",
        patch: { margin: [8, 8, 8, 8] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "8px 8px 8px 8px" }),
      },
      {
        name: "invalid → undefined, desktop mirrors base",
        patch: { margin: [8, 8, 8, 8], marginDesktop: ["nope"] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-root-margin", { base: "8px 8px 8px 8px" }),
      },
      {
        name: "box: false skips the desktop margin pair",
        patch: { margin: [8, 8, 8, 8], marginDesktop: [24, 16, 24, 16] },
        message: FULLSCREEN,
        expectCss: el => expect(el.style.getPropertyValue("--iam-root-margin-desktop")).toBe(""),
      },
    ],
  },
};

const spec: ComponentMatrixSpec<MessageRootContainerPayload, MessageRootModel> = {
  label: "Root",
  buildPayload: (patch, message): MessagePayload => ({
    ...componentMessage({}, message),
    root: { children: [], ...patch },
  }),
  select: (message: MessageModel) => message.root,
  render: (_model, message) => {
    const el = document.createElement("div");
    applyRootConfigurationStyles(el, message, { box: message.format !== "fullscreen" });
    return el;
  },
  props,
};

runComponentMatrix(spec);
