import { MessageComponentModel, MessageBox, MessageColumnsModel, MessageSpacerModel } from "../model";
import {
  normalizeBox,
  normalizeChildren,
  normalizeColor,
  normalizeHideOn,
  normalizeMarginPlacement,
  normalizeNumber,
  normalizeOptionalBox,
  normalizeRadius,
  normalizeRatios,
  normalizeVerticalAlignment,
  parseHeight,
} from "../normalize-helpers";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_COLUMNS_SPACING,
  DEFAULT_CONTENT_ALIGN,
  DEFAULT_LAYOUT_RADIUS,
  DEFAULT_SPACER_HEIGHT,
  DEFAULT_TRANSPARENT_COLOR,
} from "../normalizer-defaults";
import { MessageComponentPayload, MessageColor, MessageColumnsPayload, MessageComponentTypeValue, MessageSpacerPayload } from "../types";

export function normalizeSpacer(component: MessageSpacerPayload): MessageSpacerModel {
  return {
    type: MessageComponentTypeValue.Spacer,
    hideOn: normalizeHideOn(component.hideOn, "spacer.hideOn"),
    configuration: {
      placement: {
        height: parseHeight(component.height, DEFAULT_SPACER_HEIGHT, "spacer.height"),
      },
    },
  };
}

interface LayoutBoxPayload {
  margin?: number[];
  marginDesktop?: number[];
  padding?: number[];
  paddingDesktop?: number[];
  backgroundColor?: MessageColor;
  radius?: number[];
}

function normalizeLayoutBox(
  payload: LayoutBoxPayload,
  component: string
): {
  style: { backgroundColor: MessageColor; radius: MessageBox };
  placement: { margin: MessageBox; marginDesktop?: MessageBox; padding: MessageBox; paddingDesktop?: MessageBox };
} {
  return {
    style: {
      backgroundColor: normalizeColor(payload.backgroundColor, DEFAULT_TRANSPARENT_COLOR, `${component}.backgroundColor`),
      radius: normalizeRadius(payload.radius, DEFAULT_LAYOUT_RADIUS, `${component}.radius`),
    },
    placement: {
      ...normalizeMarginPlacement(
        payload.margin,
        DEFAULT_BOX_FALLBACK,
        `${component}.margin`,
        payload.marginDesktop,
        `${component}.marginDesktop`
      ),
      padding: normalizeBox(payload.padding, DEFAULT_BOX_FALLBACK, true, `${component}.padding`),
      paddingDesktop: normalizeOptionalBox(payload.paddingDesktop, true, `${component}.paddingDesktop`),
    },
  };
}

/** Normalizes a columns payload and its children; an omitted or partial ratio list falls back to the defaults. */
export function normalizeColumns(
  component: MessageColumnsPayload,
  normalizeChild: (component: MessageComponentPayload) => MessageComponentModel | null
): MessageColumnsModel {
  const children = normalizeChildren(component.children, normalizeChild);
  const ratios = normalizeRatios(component.ratios, children.length);
  const box = normalizeLayoutBox(component, MessageComponentTypeValue.Columns);

  return {
    type: MessageComponentTypeValue.Columns,
    hideOn: normalizeHideOn(component.hideOn, "columns.hideOn"),
    configuration: {
      style: {
        spacing: normalizeNumber(component.spacing, DEFAULT_COLUMNS_SPACING, false, "columns.spacing"),
        contentAlign: normalizeVerticalAlignment(component.contentAlign, DEFAULT_CONTENT_ALIGN, "columns.contentAlign"),
        ...box.style,
      },
      placement: box.placement,
      ratios,
      children,
    },
  };
}
