/* eslint-env jest */

import type { MessageChoiceModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_CHOICE_CHECKED_COLOR,
  DEFAULT_CHOICE_SPACING,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FIELD_FONT_SIZE,
  DEFAULT_FIELD_LABEL_FONT_SIZE,
  DEFAULT_INPUT_BORDER_COLOR,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageChoicePayload } from "com.batch.dom/render/model/types";
import { colorToCSS } from "com.batch.dom/render/render/dom-utils";
import { buildChoiceMessage, choiceLabel, list } from "com.batch.dom/render/test-utils/factories/choice-payloads";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { expectResponsivePair, expectThemePair, runComponentMatrix, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";

const css = (hex: string): string => colorToCSS(hex) ?? hex;
const CHECKED = { light: css(DEFAULT_CHOICE_CHECKED_COLOR[0]), dark: css(DEFAULT_CHOICE_CHECKED_COLOR[1]) };
const BORDER = { light: css(DEFAULT_INPUT_BORDER_COLOR[0]), dark: css(DEFAULT_INPUT_BORDER_COLOR[1]) };
const TEXT = { light: css(DEFAULT_FALLBACK_COLOR[0]), dark: css(DEFAULT_FALLBACK_COLOR[1]) };
const VEIL = { light: "rgba(0, 0, 0, 0.32)", dark: "rgba(255, 255, 255, 0.32)" };
const BOX_FALLBACK_CSS = Array(4).fill(`${DEFAULT_BOX_FALLBACK}px`).join(" ");

type StyleProps = Pick<
  MessageChoicePayload,
  | "margin"
  | "marginDesktop"
  | "spacing"
  | "layout"
  | "align"
  | "fontSize"
  | "fontSizeDesktop"
  | "labelFontSize"
  | "labelFontSizeDesktop"
  | "labelColor"
  | "textColor"
  | "borderColor"
  | "checkedColor"
>;

export const styleProps: PropMatrix<StyleProps, MessageChoiceModel> = {
  margin: {
    cases: [
      {
        name: "declared → the wrapper carries the responsive margin pair",
        patch: { margin: [1, 2, 3, 4] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([1, 2, 3, 4]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "1px 2px 3px 4px" }),
      },
      {
        name: "omitted → the shared box fallback",
        expectModel: m => expect(m.configuration.placement.margin).toEqual([0, 0, 0, 0]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: BOX_FALLBACK_CSS }),
      },
    ],
  },
  marginDesktop: {
    cases: [
      {
        name: "declared → only the desktop half of the pair changes",
        patch: { margin: [1, 1, 1, 1], marginDesktop: [8, 8, 8, 8] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toEqual([8, 8, 8, 8]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "1px 1px 1px 1px", desktop: "8px 8px 8px 8px" }),
      },
      {
        name: "omitted → the desktop half mirrors the base",
        patch: { margin: [2, 2, 2, 2] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "2px 2px 2px 2px" }),
      },
    ],
  },
  spacing: {
    cases: [
      {
        name: "declared → the gap between two options",
        patch: { spacing: 20 },
        expectModel: m => expect(m.configuration.spacing).toBe(20),
        expectCss: el => expectResponsivePair(list(el), "iam-choice-spacing", { base: "20px" }),
      },
      {
        name: "omitted → the default gap",
        expectModel: m => expect(m.configuration.spacing).toBe(DEFAULT_CHOICE_SPACING),
        expectCss: el => expectResponsivePair(list(el), "iam-choice-spacing", { base: `${DEFAULT_CHOICE_SPACING}px` }),
      },
      {
        name: "invalid → the default gap, and the payload never reaches CSS",
        patch: { spacing: -4 },
        expectModel: m => expect(m.configuration.spacing).toBe(DEFAULT_CHOICE_SPACING),
      },
    ],
  },
  layout: {
    cases: [
      {
        name: "horizontal → the list turns into a row",
        patch: { layout: "horizontal" },
        expectModel: m => expect(m.configuration.layout).toBe("horizontal"),
        expectCss: el => expect(list(el).classList.contains("iam-choice-list--horizontal")).toBe(true),
      },
      {
        name: "omitted → the list stacks, without the row modifier",
        expectModel: m => expect(m.configuration.layout).toBe("vertical"),
        expectCss: el => expect(list(el).classList.contains("iam-choice-list--horizontal")).toBe(false),
      },
      {
        name: "unknown → the default direction",
        patch: { layout: "diagonal" },
        expectModel: m => expect(m.configuration.layout).toBe("vertical"),
      },
    ],
  },
  align: {
    cases: [
      {
        name: "right → the options sit at the end of the line",
        patch: { align: "right" },
        expectModel: m => expect(m.configuration.align).toBe("right"),
        expectCss: el => expect(list(el).style.getPropertyValue("--iam-choice-align")).toBe("flex-end"),
      },
      {
        name: "center → the options sit in the middle of the line",
        patch: { align: "center" },
        expectModel: m => expect(m.configuration.align).toBe("center"),
        expectCss: el => expect(list(el).style.getPropertyValue("--iam-choice-align")).toBe("center"),
      },
      {
        name: "omitted → the options start the line, like the fields around them",
        expectModel: m => expect(m.configuration.align).toBe("left"),
        expectCss: el => expect(list(el).style.getPropertyValue("--iam-choice-align")).toBe("flex-start"),
      },
      {
        name: "unknown → the default placement",
        patch: { align: "diagonal" },
        expectModel: m => expect(m.configuration.align).toBe("left"),
      },
    ],
  },
  fontSize: {
    cases: [
      {
        name: "declared → the option text size",
        patch: { fontSize: 18 },
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(18),
        expectCss: el => expectResponsivePair(list(el), "iam-font-size", { base: "18px" }),
      },
      {
        name: "omitted → the shared field size",
        expectModel: m => expect(m.configuration.fontStyle.fontSize).toBe(DEFAULT_FIELD_FONT_SIZE),
        expectCss: el => expectResponsivePair(list(el), "iam-font-size", { base: `${DEFAULT_FIELD_FONT_SIZE}px` }),
      },
    ],
  },
  fontSizeDesktop: {
    cases: [
      {
        name: "declared → only the desktop half of the pair changes",
        patch: { fontSize: 14, fontSizeDesktop: 20 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBe(20),
        expectCss: el => expectResponsivePair(list(el), "iam-font-size", { base: "14px", desktop: "20px" }),
      },
      {
        name: "invalid → no desktop override at all",
        patch: { fontSize: 14, fontSizeDesktop: -2 },
        expectModel: m => expect(m.configuration.fontStyle.fontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(list(el), "iam-font-size", { base: "14px" }),
      },
    ],
  },
  labelFontSize: {
    cases: [
      {
        name: "declared → the label size",
        patch: { labelFontSize: 22 },
        expectModel: m => expect(m.configuration.labelFontSize).toBe(22),
        expectCss: el => expectResponsivePair(choiceLabel(el), "iam-label-font-size", { base: "22px" }),
      },
      {
        name: "omitted → the shared label size",
        expectModel: m => expect(m.configuration.labelFontSize).toBe(DEFAULT_FIELD_LABEL_FONT_SIZE),
        expectCss: el => expectResponsivePair(choiceLabel(el), "iam-label-font-size", { base: `${DEFAULT_FIELD_LABEL_FONT_SIZE}px` }),
      },
    ],
  },
  labelFontSizeDesktop: {
    cases: [
      {
        name: "declared → only the desktop half of the label pair changes",
        patch: { labelFontSize: 12, labelFontSizeDesktop: 16 },
        expectModel: m => expect(m.configuration.labelFontSizeDesktop).toBe(16),
        expectCss: el => expectResponsivePair(choiceLabel(el), "iam-label-font-size", { base: "12px", desktop: "16px" }),
      },
      {
        name: "omitted → the desktop half mirrors the base",
        patch: { labelFontSize: 12 },
        expectModel: m => expect(m.configuration.labelFontSizeDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(choiceLabel(el), "iam-label-font-size", { base: "12px" }),
      },
    ],
  },
  labelColor: {
    cases: [
      {
        name: "declared → the label theme pair",
        patch: { labelColor: ["#102030FF", "#405060FF"] },
        expectModel: m => expect(m.configuration.labelColor).toEqual(["#102030FF", "#405060FF"]),
        expectCss: el => expectThemePair(choiceLabel(el), "iam-label-color", { light: css("#102030FF"), dark: css("#405060FF") }),
      },
      {
        name: "omitted → the label inherits the option text color",
        patch: { textColor: ["#010203FF"] },
        expectModel: m => expect(m.configuration.labelColor).toEqual(["#010203FF", "#010203FF"]),
        expectCss: el => expectThemePair(choiceLabel(el), "iam-label-color", { light: css("#010203FF") }),
      },
    ],
  },
  textColor: {
    cases: [
      {
        name: "declared → the option text theme pair",
        patch: { textColor: ["#112233FF", "#445566FF"] },
        expectModel: m => expect(m.configuration.textColor).toEqual(["#112233FF", "#445566FF"]),
        expectCss: el => expectThemePair(list(el), "iam-color", { light: css("#112233FF"), dark: css("#445566FF") }),
      },
      {
        name: "omitted → the shared fallback color",
        expectModel: m => expect(m.configuration.textColor).toEqual(DEFAULT_FALLBACK_COLOR),
        expectCss: el => expectThemePair(list(el), "iam-color", TEXT),
      },
    ],
  },
  borderColor: {
    cases: [
      {
        name: "declared → the box border theme pair",
        patch: { borderColor: ["#AABBCCFF", "#DDEEFFFF"] },
        expectModel: m => expect(m.configuration.borderColor).toEqual(["#AABBCCFF", "#DDEEFFFF"]),
        expectCss: el => expectThemePair(list(el), "iam-border-color", { light: css("#AABBCCFF"), dark: css("#DDEEFFFF") }),
      },
      {
        name: "omitted → the input border color, so a choice matches the fields around it",
        expectModel: m => expect(m.configuration.borderColor).toEqual(DEFAULT_INPUT_BORDER_COLOR),
        expectCss: el => expectThemePair(list(el), "iam-border-color", BORDER),
      },
      {
        name: "painting → the focus veil pair the box ring reads",
        patch: { borderColor: ["#123456FF"] },
        expectModel: m => expect(m.configuration.borderColor).toEqual(["#123456FF", "#123456FF"]),
        expectCss: el => expectThemePair(list(el), "iam-focus-veil", VEIL),
      },
      {
        name: "transparent → no veil, the browser outline stays",
        patch: { borderColor: ["transparent"] },
        expectModel: m => expect(m.configuration.borderColor).toEqual(["transparent", "transparent"]),
        expectCss: el => {
          expect(list(el).style.getPropertyValue("--iam-focus-veil")).toBe("");
          expect(list(el).style.getPropertyValue("--iam-focus-veil-dark")).toBe("");
        },
      },
    ],
  },
  checkedColor: {
    cases: [
      {
        name: "declared → the checked box theme pair",
        patch: { checkedColor: ["#008000FF", "#00FF00FF"] },
        expectModel: m => expect(m.configuration.checkedColor).toEqual(["#008000FF", "#00FF00FF"]),
        expectCss: el => expectThemePair(list(el), "iam-choice-checked-color", { light: css("#008000FF"), dark: css("#00FF00FF") }),
      },
      {
        name: "omitted → the input border color",
        expectModel: m => expect(m.configuration.checkedColor).toEqual(DEFAULT_CHOICE_CHECKED_COLOR),
        expectCss: el => expectThemePair(list(el), "iam-choice-checked-color", CHECKED),
      },
    ],
  },
};

const spec: ComponentMatrixSpec<StyleProps, MessageChoiceModel> = {
  label: "Choice style",
  buildPayload: buildChoiceMessage,
  select: message => selectFirstChild<MessageChoiceModel>(message, "choice"),
  props: styleProps,
};

runComponentMatrix(spec);
