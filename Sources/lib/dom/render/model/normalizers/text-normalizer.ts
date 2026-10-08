import { MessageLabelModel } from "../model";
import { normalizeHideOn, normalizeMarginPlacement, normalizeTextConfiguration } from "../normalize-helpers";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_MAX_LINES,
} from "../normalizer-defaults";
import { MessageComponentTypeValue, MessageLabelPayload } from "../types";

export function normalizeLabel(component: MessageLabelPayload): MessageLabelModel {
  const textConfiguration = normalizeTextConfiguration(
    {
      align: component.textAlign,
      color: component.color,
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
    MessageComponentTypeValue.Text
  );

  return {
    type: MessageComponentTypeValue.Text,
    id: component.id,
    hideOn: normalizeHideOn(component.hideOn, "text.hideOn"),
    configuration: {
      contentRef: component.id,
      style: textConfiguration.style,
      fontStyle: textConfiguration.fontStyle,
      placement: normalizeMarginPlacement(
        component.margin,
        DEFAULT_BOX_FALLBACK,
        "text.margin",
        component.marginDesktop,
        "text.marginDesktop"
      ),
    },
  };
}
