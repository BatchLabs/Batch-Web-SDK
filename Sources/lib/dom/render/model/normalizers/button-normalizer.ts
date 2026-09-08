import { MessageButtonModel } from "../model";
import {
  normalizeBorderStyleConfiguration,
  normalizeBox,
  normalizeHideOn,
  normalizeHorizontalAlignment,
  normalizeMarginPlacement,
  normalizeOptionalBox,
  normalizeTextConfiguration,
  parseWidth,
} from "../normalize-helpers";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_BUTTON_BORDER_WIDTH,
  DEFAULT_BUTTON_RADIUS,
  DEFAULT_BUTTON_WIDTH,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_HORIZONTAL_ALIGN,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_MAX_LINES,
  DEFAULT_TRANSPARENT_COLOR,
} from "../normalizer-defaults";
import { MessageButtonPayload } from "../types";

export function normalizeButton(component: MessageButtonPayload): MessageButtonModel {
  const textConfiguration = normalizeTextConfiguration(
    {
      align: component.textAlign,
      color: component.textColor,
      maxLines: component.maxLines,
      fontSize: component.fontSize,
      fontSizeDesktop: component.fontSizeDesktop,
      fontDecoration: component.fontDecoration,
    },
    {
      align: DEFAULT_TEXT_ALIGN,
      color: DEFAULT_FALLBACK_COLOR,
      maxLines: DEFAULT_TEXT_MAX_LINES,
      fontSize: DEFAULT_FONT_SIZE,
    },
    "button",
    "textColor"
  );

  return {
    type: "button",
    id: component.id,
    hideOn: normalizeHideOn(component.hideOn, "button.hideOn"),
    configuration: {
      contentRef: component.id,
      actionRef: component.id,
      style: {
        ...normalizeBorderStyleConfiguration(
          {
            backgroundColor: component.backgroundColor,
            radius: component.radius,
            borderWidth: component.borderWidth,
            borderColor: component.borderColor,
          },
          {
            backgroundColor: DEFAULT_TRANSPARENT_COLOR,
            radius: DEFAULT_BUTTON_RADIUS,
            borderWidth: DEFAULT_BUTTON_BORDER_WIDTH,
            borderColor: DEFAULT_TRANSPARENT_COLOR,
          },
          "button"
        ),
        ...textConfiguration.style,
      },
      fontStyle: textConfiguration.fontStyle,
      placement: {
        ...normalizeMarginPlacement(
          component.margin,
          DEFAULT_BOX_FALLBACK,
          "button.margin",
          component.marginDesktop,
          "button.marginDesktop"
        ),
        padding: normalizeBox(component.padding, DEFAULT_BOX_FALLBACK, true, "button.padding"),
        paddingDesktop: normalizeOptionalBox(component.paddingDesktop, true, "button.paddingDesktop"),
        width: parseWidth(component.width, DEFAULT_BUTTON_WIDTH, "button.width"),
        align: normalizeHorizontalAlignment(component.align, DEFAULT_HORIZONTAL_ALIGN, "button.align"),
      },
    },
  };
}
