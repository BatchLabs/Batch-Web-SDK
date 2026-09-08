/* eslint-env jest */

import type { MessageInputModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FIELD_FONT_SIZE,
  DEFAULT_FIELD_LABEL_FONT_SIZE,
  DEFAULT_FIELD_WIDTH,
  DEFAULT_HORIZONTAL_ALIGN,
  DEFAULT_INPUT_BACKGROUND_COLOR,
  DEFAULT_INPUT_BORDER_COLOR,
  DEFAULT_INPUT_BORDER_WIDTH,
  DEFAULT_INPUT_RADIUS,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageAnyComponentPayload, MessageInputPayload, MessagePayload } from "com.batch.dom/render/model/types";
import { FORM_SUBMIT_ACTION_ID } from "com.batch.dom/render/render-constants";
import { colorToCSS } from "com.batch.dom/render/render/dom-utils";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { expectResponsivePair, expectThemePair, runComponentMatrix, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";

const FIELD_ID = "email";
const FIELD_MAP_TO = "email_map";
const SUBMIT_ID = "cta";

function buildFieldMessage(patch: Record<string, unknown>, message?: Partial<MessagePayload>): MessagePayload {
  const children = [
    { type: "field", id: FIELD_ID, mapsTo: FIELD_MAP_TO, placeholderId: "email_ph", labelTextId: "email_label", ...patch },
    { type: "button", id: SUBMIT_ID },
  ];
  return {
    format: "modal",
    root: { children: children as unknown as MessageAnyComponentPayload[] },
    closeOptions: {},
    texts: { email_label: "Email", email_ph: "you@example.com" },
    urls: {},
    actions: { [SUBMIT_ID]: { action: FORM_SUBMIT_ACTION_ID } },
    ...message,
  };
}

const control = (el: HTMLElement): HTMLInputElement => el.querySelector(".iam-input") as HTMLInputElement;
const label = (el: HTMLElement): HTMLElement => el.querySelector(".iam-field-label") as HTMLElement;

const css = (hex: string): string => colorToCSS(hex) ?? hex;
const FALLBACK_COLOR = { light: css(DEFAULT_FALLBACK_COLOR[0]), dark: css(DEFAULT_FALLBACK_COLOR[1]) };
const INPUT_BG = { light: css(DEFAULT_INPUT_BACKGROUND_COLOR[0]), dark: css(DEFAULT_INPUT_BACKGROUND_COLOR[1]) };
const INPUT_BORDER = { light: css(DEFAULT_INPUT_BORDER_COLOR[0]), dark: css(DEFAULT_INPUT_BORDER_COLOR[1]) };
const VEIL = { light: "rgba(0, 0, 0, 0.32)", dark: "rgba(255, 255, 255, 0.32)" };
const hasFocusRing = (el: HTMLElement): boolean => control(el).classList.contains("iam-input--focus-ring");

const BOX_FALLBACK = [DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK];
const BOX_FALLBACK_CSS = BOX_FALLBACK.map(v => `${v}px`).join(" ");
const RADIUS_FALLBACK = [DEFAULT_INPUT_RADIUS, DEFAULT_INPUT_RADIUS, DEFAULT_INPUT_RADIUS, DEFAULT_INPUT_RADIUS];
const RADIUS_FALLBACK_CSS = RADIUS_FALLBACK.map(v => `${v}px`).join(" ");

type StyleProps = Pick<
  MessageInputPayload,
  | "margin"
  | "marginDesktop"
  | "padding"
  | "paddingDesktop"
  | "width"
  | "align"
  | "fontSize"
  | "fontSizeDesktop"
  | "labelFontSize"
  | "labelFontSizeDesktop"
  | "labelColor"
  | "placeholderColor"
  | "textColor"
  | "backgroundColor"
  | "borderColor"
  | "borderWidth"
  | "radius"
>;

export const styleProps: PropMatrix<StyleProps, MessageInputModel> = {
  width: {
    cases: [
      {
        name: "partial → percentage on wrapper",
        patch: { width: 50 },
        expectModel: m => expect(m.configuration.width).toBe(50),
        expectCss: el => expect(el.style.width).toBe("50%"),
      },
      {
        name: "100 → wrapper width left unset, the wrapper stretches",
        patch: { width: 100 },
        expectModel: m => expect(m.configuration.width).toBe(100),
        expectCss: el => {
          expect(el.style.width).toBe("");
          expect(el.style.alignSelf).toBe("stretch");
        },
      },
      {
        name: "omitted → DEFAULT_FIELD_WIDTH",
        patch: {},
        expectModel: m => expect(m.configuration.width).toBe(DEFAULT_FIELD_WIDTH),
        expectCss: el => expect(el.style.width).toBe(""),
      },
      {
        name: "0 → DEFAULT_FIELD_WIDTH",
        patch: { width: 0 },
        expectModel: m => expect(m.configuration.width).toBe(DEFAULT_FIELD_WIDTH),
        expectCss: el => expect(el.style.width).toBe(""),
      },
      {
        name: "above 100 → DEFAULT_FIELD_WIDTH",
        patch: { width: 150 },
        expectModel: m => expect(m.configuration.width).toBe(DEFAULT_FIELD_WIDTH),
        expectCss: el => expect(el.style.width).toBe(""),
      },
    ],
  },

  align: {
    cases: [
      {
        name: "left → flex-start",
        patch: { align: "left", width: 50 },
        expectModel: m => expect(m.configuration.align).toBe("left"),
        expectCss: el => expect(el.style.alignSelf).toBe("flex-start"),
      },
      {
        name: "center → center",
        patch: { align: "center", width: 50 },
        expectModel: m => expect(m.configuration.align).toBe("center"),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
      {
        name: "right → flex-end",
        patch: { align: "right", width: 50 },
        expectModel: m => expect(m.configuration.align).toBe("right"),
        expectCss: el => expect(el.style.alignSelf).toBe("flex-end"),
      },
      {
        name: "ignored on a full width: the wrapper stretches",
        patch: { align: "left" },
        expectModel: m => expect(m.configuration.align).toBe("left"),
        expectCss: el => expect(el.style.alignSelf).toBe("stretch"),
      },
      {
        name: "omitted → DEFAULT_HORIZONTAL_ALIGN (center)",
        patch: { width: 50 },
        expectModel: m => expect(m.configuration.align).toBe(DEFAULT_HORIZONTAL_ALIGN),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
      {
        name: "invalid → center",
        patch: { align: "diagonal", width: 50 },
        expectModel: m => expect(m.configuration.align).toBe("center"),
        expectCss: el => expect(el.style.alignSelf).toBe("center"),
      },
    ],
  },

  fontSize: {
    cases: [
      {
        name: "explicit",
        patch: { fontSize: 20 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(20),
        expectCss: el => expectResponsivePair(control(el), "iam-input-font-size", { base: "20px" }),
      },
      {
        name: "omitted → DEFAULT_FIELD_FONT_SIZE",
        patch: {},
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FIELD_FONT_SIZE),
        expectCss: el => expectResponsivePair(control(el), "iam-input-font-size", { base: `${DEFAULT_FIELD_FONT_SIZE}px` }),
      },
    ],
  },
  fontSizeDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { fontSize: 16, fontSizeDesktop: 22 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBe(22),
        expectCss: el => expectResponsivePair(control(el), "iam-input-font-size", { base: "16px", desktop: "22px" }),
      },
      {
        name: "omitted → desktop mirrors base",
        patch: { fontSize: 18 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(control(el), "iam-input-font-size", { base: "18px" }),
      },
    ],
  },

  labelFontSize: {
    cases: [
      {
        name: "explicit",
        patch: { labelFontSize: 12 },
        expectModel: m => expect(m.configuration.labelFontSize).toBe(12),
        expectCss: el => expectResponsivePair(label(el), "iam-label-font-size", { base: "12px" }),
      },
      {
        name: "omitted → DEFAULT_FIELD_LABEL_FONT_SIZE",
        patch: {},
        expectModel: m => expect(m.configuration.labelFontSize).toBe(DEFAULT_FIELD_LABEL_FONT_SIZE),
        expectCss: el => expectResponsivePair(label(el), "iam-label-font-size", { base: `${DEFAULT_FIELD_LABEL_FONT_SIZE}px` }),
      },
    ],
  },
  labelFontSizeDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { labelFontSize: 12, labelFontSizeDesktop: 16 },
        expectModel: m => expect(m.configuration.labelFontSizeDesktop).toBe(16),
        expectCss: el => expectResponsivePair(label(el), "iam-label-font-size", { base: "12px", desktop: "16px" }),
      },
      {
        name: "omitted → desktop mirrors base",
        patch: { labelFontSize: 12 },
        expectModel: m => expect(m.configuration.labelFontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(label(el), "iam-label-font-size", { base: "12px" }),
      },
    ],
  },

  labelColor: {
    cases: [
      {
        name: "explicit single → dark mirrors light",
        patch: { labelColor: ["#333333FF"] },
        expectModel: m => expect(m.configuration.labelColor).toEqual(["#333333FF", "#333333FF"]),
        expectCss: el => expectThemePair(label(el), "iam-label-color", { light: "rgba(51,51,51,1.000)" }),
      },
      {
        name: "light+dark pair",
        patch: { labelColor: ["#FF0000FF", "#00FF00FF"] },
        expectModel: m => expect(m.configuration.labelColor).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el => expectThemePair(label(el), "iam-label-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" }),
      },
      {
        name: "omitted falls back to the text color",
        patch: { textColor: ["#112233FF"] },
        expectModel: m => expect(m.configuration.labelColor).toEqual(["#112233FF", "#112233FF"]),
        expectCss: el => expectThemePair(label(el), "iam-label-color", { light: "rgba(17,34,51,1.000)" }),
      },
      {
        name: "labelColor and textColor omitted → DEFAULT_FALLBACK_COLOR",
        patch: {},
        expectModel: m => expect(m.configuration.labelColor).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(label(el), "iam-label-color", FALLBACK_COLOR),
      },
    ],
  },

  placeholderColor: {
    cases: [
      {
        name: "explicit pair",
        patch: { placeholderColor: ["#FF0000FF", "#00FF00FF"] },
        expectModel: m => expect(m.configuration.placeholderColor).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el => {
          expectThemePair(control(el), "iam-placeholder-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" });
          expect(control(el).style.getPropertyValue("--iam-placeholder-opacity")).toBe("1");
        },
      },
      {
        name: "only the dark channel valid → mirrored onto both",
        patch: { placeholderColor: ["nope", "#112233"] },
        expectModel: m => expect(m.configuration.placeholderColor).toEqual(["#112233", "#112233"]),
        expectCss: el => expectThemePair(control(el), "iam-placeholder-color", { light: "#112233", dark: "#112233" }),
      },
      {
        name: "single → dark mirrors light",
        patch: { placeholderColor: ["#999999FF"] },
        expectModel: m => expect(m.configuration.placeholderColor).toEqual(["#999999FF", "#999999FF"]),
        expectCss: el => expectThemePair(control(el), "iam-placeholder-color", { light: "rgba(153,153,153,1.000)" }),
      },
      {
        name: "omitted → no variable, placeholder inherits text color",
        patch: {},
        expectModel: m => expect(m.configuration.placeholderColor).toBeUndefined(),
        expectCss: el => {
          expect(control(el).style.getPropertyValue("--iam-placeholder-color")).toBe("");
          expect(control(el).style.getPropertyValue("--iam-placeholder-opacity")).toBe("");
        },
      },
      {
        name: "invalid → dropped, stays absent",
        patch: { placeholderColor: ["red"] },
        expectModel: m => expect(m.configuration.placeholderColor).toBeUndefined(),
        expectCss: el => {
          expect(control(el).style.getPropertyValue("--iam-placeholder-color")).toBe("");
          expect(control(el).style.getPropertyValue("--iam-placeholder-color-dark")).toBe("");
        },
      },
    ],
  },

  textColor: {
    cases: [
      {
        name: "explicit pair",
        patch: { textColor: ["#FF0000FF", "#00FF00FF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el => expectThemePair(control(el), "iam-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" }),
      },
      {
        name: "single → dark mirrors light",
        patch: { textColor: ["#ABCDEFFF"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(["#ABCDEFFF", "#ABCDEFFF"]),
        expectCss: el => expectThemePair(control(el), "iam-color", { light: "rgba(171,205,239,1.000)" }),
      },
      {
        name: "omitted → DEFAULT_FALLBACK_COLOR",
        patch: {},
        expectModel: m => expect(m.configuration.style.color).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(control(el), "iam-color", FALLBACK_COLOR),
      },
      {
        name: "invalid → DEFAULT_FALLBACK_COLOR",
        patch: { textColor: ["red"] },
        expectModel: m => expect(m.configuration.style.color).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(control(el), "iam-color", FALLBACK_COLOR),
      },
    ],
  },

  backgroundColor: {
    cases: [
      {
        name: "explicit",
        patch: { backgroundColor: ["#0044FFFF"] },
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(["#0044FFFF", "#0044FFFF"]),
        expectCss: el => expectThemePair(control(el), "iam-bg", { light: "rgba(0,68,255,1.000)" }),
      },
      {
        name: "omitted → DEFAULT_INPUT_BACKGROUND_COLOR",
        patch: {},
        expectModel: m => expect(m.configuration.style.backgroundColor).toEqual(DEFAULT_INPUT_BACKGROUND_COLOR),
        expectCss: el => expectThemePair(control(el), "iam-bg", INPUT_BG),
      },
    ],
  },

  borderColor: {
    cases: [
      {
        name: "explicit",
        patch: { borderWidth: 1, borderColor: ["#123456FF"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#123456FF", "#123456FF"]),
        expectCss: el => {
          expectThemePair(control(el), "iam-border-color", { light: "rgba(18,52,86,1.000)" });
          expect(hasFocusRing(el)).toBe(true);
          expectThemePair(control(el), "iam-focus-veil", VEIL);
        },
      },
      {
        name: "omitted → DEFAULT_INPUT_BORDER_COLOR, but no stroke to carry it",
        patch: {},
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(DEFAULT_INPUT_BORDER_COLOR),
        expectCss: el => {
          expectThemePair(control(el), "iam-border-color", INPUT_BORDER);
          expect(hasFocusRing(el)).toBe(false);
        },
      },
      {
        name: "explicit width alone → the default color arms the ring",
        patch: { borderWidth: 1 },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(DEFAULT_INPUT_BORDER_COLOR),
        expectCss: el => {
          expectThemePair(control(el), "iam-border-color", INPUT_BORDER);
          expect(hasFocusRing(el)).toBe(true);
          expectThemePair(control(el), "iam-focus-veil", VEIL);
        },
      },
      {
        name: "functional notation still arms the ring",
        patch: { borderWidth: 1, borderColor: ["oklch(0.8 0.02 260)"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["oklch(0.8 0.02 260)", "oklch(0.8 0.02 260)"]),
        expectCss: el => {
          expect(hasFocusRing(el)).toBe(true);
          expectThemePair(control(el), "iam-focus-veil", VEIL);
        },
      },
      {
        name: "transparent → no focus ring",
        patch: { borderWidth: 1, borderColor: ["transparent"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["transparent", "transparent"]),
        expectCss: el => {
          expect(hasFocusRing(el)).toBe(false);
          expect(control(el).style.getPropertyValue("--iam-focus-veil")).toBe("");
        },
      },
      {
        name: "zero alpha → no focus ring",
        patch: { borderWidth: 1, borderColor: ["#12345600"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#12345600", "#12345600"]),
        expectCss: el => expect(hasFocusRing(el)).toBe(false),
      },
      {
        name: "painting in one theme only → no ring, the browser outline stays",
        patch: { borderWidth: 1, borderColor: ["#800040FF", "#00000000"] },
        expectModel: m => expect(m.configuration.style.borderColor).toEqual(["#800040FF", "#00000000"]),
        expectCss: el => {
          expect(hasFocusRing(el)).toBe(false);
          expect(control(el).style.getPropertyValue("--iam-focus-veil")).toBe("");
        },
      },
    ],
  },

  borderWidth: {
    cases: [
      {
        name: "explicit",
        patch: { borderWidth: 3 },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(3),
        expectCss: el => expect(control(el).style.borderWidth).toBe("3px"),
      },
      {
        name: "omitted → DEFAULT_INPUT_BORDER_WIDTH, so no border at all",
        patch: {},
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(0),
        expectCss: el => {
          expect(control(el).style.borderWidth).toBe("0px");
          expect(control(el).classList.contains("iam-input--focus-ring")).toBe(false);
        },
      },
      {
        name: "negative → DEFAULT_INPUT_BORDER_WIDTH",
        patch: { borderWidth: -1 },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(DEFAULT_INPUT_BORDER_WIDTH),
        expectCss: el => expect(control(el).style.borderWidth).toBe(`${DEFAULT_INPUT_BORDER_WIDTH}px`),
      },
      {
        name: "explicit zero → no focus ring",
        patch: { borderWidth: 0 },
        expectModel: m => expect(m.configuration.style.borderWidth).toBe(0),
        expectCss: el => {
          expect(control(el).style.borderWidth).toBe("0px");
          expect(control(el).classList.contains("iam-input--focus-ring")).toBe(false);
        },
      },
    ],
  },

  radius: {
    cases: [
      {
        name: "four-value box",
        patch: { radius: [8, 4, 8, 4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual([8, 4, 8, 4]),
        expectCss: el => expect(control(el).style.borderRadius).toBe("8px 4px 8px 4px"),
      },
      {
        name: "shorthand [8,4] → [8,4,8,4]",
        patch: { radius: [8, 4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual([8, 4, 8, 4]),
        expectCss: el => expect(control(el).style.borderRadius).toBe("8px 4px 8px 4px"),
      },
      {
        name: "omitted → DEFAULT_INPUT_RADIUS box",
        patch: {},
        expectModel: m => expect(m.configuration.style.radius).toEqual(RADIUS_FALLBACK),
        expectCss: el => expect(control(el).style.borderRadius).toBe(RADIUS_FALLBACK_CSS),
      },
    ],
  },

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
        expectModel: m => expect(m.configuration.placement.margin).toEqual(BOX_FALLBACK),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: BOX_FALLBACK_CSS }),
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
        name: "omitted → desktop mirrors base",
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
        expectCss: el => expectResponsivePair(control(el), "iam-padding", { base: "6px 10px 6px 10px" }),
      },
      {
        name: "omitted → DEFAULT_BOX_FALLBACK box",
        patch: {},
        expectModel: m => expect(m.configuration.placement.padding).toEqual(BOX_FALLBACK),
        expectCss: el => expectResponsivePair(control(el), "iam-padding", { base: BOX_FALLBACK_CSS }),
      },
    ],
  },
  paddingDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { padding: [6, 10, 6, 10], paddingDesktop: [12, 20, 12, 20] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toEqual([12, 20, 12, 20]),
        expectCss: el => expectResponsivePair(control(el), "iam-padding", { base: "6px 10px 6px 10px", desktop: "12px 20px 12px 20px" }),
      },
      {
        name: "omitted → desktop mirrors base",
        patch: { padding: [6, 10, 6, 10] },
        expectModel: m => expect(m.configuration.placement.paddingDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(control(el), "iam-padding", { base: "6px 10px 6px 10px" }),
      },
    ],
  },
};

const spec: ComponentMatrixSpec<StyleProps, MessageInputModel> = {
  label: "Field style",
  buildPayload: buildFieldMessage,
  select: message => selectFirstChild<MessageInputModel>(message, "field"),
  props: styleProps,
};

runComponentMatrix(spec);
