import { MessageImageModel } from "../model";
import { normalizeHideOn, normalizeMarginPlacement, normalizeRadius, parseAspectRatio, parseHeight } from "../normalize-helpers";
import { DEFAULT_BOX_FALLBACK, DEFAULT_IMAGE_ASPECT_RATIO, DEFAULT_IMAGE_HEIGHT, DEFAULT_IMAGE_RADIUS } from "../normalizer-defaults";
import { MessageComponentTypeValue, MessageImagePayload } from "../types";

export function normalizeImage(component: MessageImagePayload): MessageImageModel {
  return {
    type: MessageComponentTypeValue.Image,
    id: component.id,
    hideOn: normalizeHideOn(component.hideOn, "image.hideOn"),
    configuration: {
      contentRef: component.id,
      style: {
        aspect: parseAspectRatio(component.aspect, DEFAULT_IMAGE_ASPECT_RATIO, "image.aspect"),
        radius: normalizeRadius(component.radius, DEFAULT_IMAGE_RADIUS, "image.radius"),
      },
      placement: {
        ...normalizeMarginPlacement(component.margin, DEFAULT_BOX_FALLBACK, "image.margin", component.marginDesktop, "image.marginDesktop"),
        height: parseHeight(component.height, DEFAULT_IMAGE_HEIGHT, "image.height"),
      },
      accessibility: {
        label: typeof component.accessibilityLabel === "string" ? component.accessibilityLabel.trim() || undefined : undefined,
      },
    },
  };
}
