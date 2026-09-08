import { MessageDividerModel } from "../model";
import {
  normalizeColor,
  normalizeHideOn,
  normalizeHorizontalAlignment,
  normalizeMarginPlacement,
  normalizeNumber,
  parseWidth,
} from "../normalize-helpers";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_DIVIDER_THICKNESS,
  DEFAULT_DIVIDER_WIDTH,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_HORIZONTAL_ALIGN,
} from "../normalizer-defaults";
import { MessageDividerPayload } from "../types";

export function normalizeDivider(component: MessageDividerPayload): MessageDividerModel {
  return {
    type: "divider",
    hideOn: normalizeHideOn(component.hideOn, "divider.hideOn"),
    configuration: {
      style: {
        color: normalizeColor(component.color, DEFAULT_FALLBACK_COLOR, "divider.color"),
        thickness: normalizeNumber(component.thickness, DEFAULT_DIVIDER_THICKNESS, false, "divider.thickness"),
      },
      placement: {
        ...normalizeMarginPlacement(
          component.margin,
          DEFAULT_BOX_FALLBACK,
          "divider.margin",
          component.marginDesktop,
          "divider.marginDesktop"
        ),
        width: parseWidth(component.width, DEFAULT_DIVIDER_WIDTH, "divider.width"),
        align: normalizeHorizontalAlignment(component.align, DEFAULT_HORIZONTAL_ALIGN, "divider.align"),
      },
    },
  };
}
