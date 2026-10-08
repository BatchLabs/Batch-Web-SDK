import { RENDER_LOG_MODULE } from "com.batch.dom/render/render-constants";
import { Log } from "com.batch.shared/logger";

import { MessageComponentModel, MessageCloseOptionsModel, MessageModel } from "./model";
import {
  normalizeBorderStyleConfiguration,
  normalizeChildren,
  normalizeColor,
  normalizeMarginPlacement,
  normalizeTimeInterval,
  normalizeVerticalAlignment,
} from "./normalize-helpers";
import {
  DEFAULT_AUTO_CLOSE_DELAY,
  DEFAULT_BOX_FALLBACK,
  DEFAULT_CLOSE_BUTTON_BACKGROUND,
  DEFAULT_CLOSE_BUTTON_COLOR,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FORMAT,
  DEFAULT_FULLSCREEN_POSITION,
  DEFAULT_MODAL_CLOSE_BUTTON,
  DEFAULT_MODAL_POSITION,
  DEFAULT_ROOT_BACKGROUND_COLOR,
  DEFAULT_ROOT_BORDER_WIDTH,
  DEFAULT_ROOT_RADIUS,
  DEFAULT_TRANSPARENT_COLOR,
} from "./normalizer-defaults";
import { normalizeButton } from "./normalizers/button-normalizer";
import { normalizeChoice } from "./normalizers/choice-normalizer";
import { normalizeDivider } from "./normalizers/divider-normalizer";
import { normalizeInput } from "./normalizers/field-normalizer";
import { normalizeImage } from "./normalizers/image-normalizer";
import { normalizeColumns, normalizeSpacer } from "./normalizers/layout-normalizer";
import { normalizeLabel } from "./normalizers/text-normalizer";
import {
  isMessageFormat,
  MessageAction,
  MessageComponentPayload,
  MessageComponentTypeValue,
  MessageFormat,
  MessageFormatValue,
  MessagePayload,
  MessageVerticalAlignment,
} from "./types";
import { filterSafeURLEntries } from "./url";

function defaultPositionForFormat(format: MessageFormat): MessageVerticalAlignment {
  if (format === MessageFormatValue.Fullscreen) {
    return DEFAULT_FULLSCREEN_POSITION;
  }
  return DEFAULT_MODAL_POSITION;
}

/** Converts a permissive payload into the renderer-ready model. */
export function normalizeMessage(payload: MessagePayload): MessageModel {
  const isValidFormat = isMessageFormat(payload.format);
  if (!isValidFormat) {
    Log.warn(RENDER_LOG_MODULE, `[normalizer] unknown format "${payload.format}", falling back to "${DEFAULT_FORMAT}"`);
  }
  const format = isValidFormat ? payload.format : DEFAULT_FORMAT;
  const closeOptions = normalizeCloseOptions(payload.closeOptions);

  const actions: Record<string, MessageAction> = { ...payload.actions };

  return {
    format,
    minMLvl: payload.minMLvl,
    position: normalizeVerticalAlignment(payload.position, defaultPositionForFormat(format), "message.position"),
    root: {
      configuration: {
        style: normalizeBorderStyleConfiguration(
          {
            backgroundColor: payload.root?.backgroundColor,
            radius: payload.root?.radius,
            borderWidth: payload.root?.borderWidth,
            borderColor: payload.root?.borderColor,
          },
          {
            backgroundColor: DEFAULT_ROOT_BACKGROUND_COLOR,
            radius: DEFAULT_ROOT_RADIUS,
            borderWidth: DEFAULT_ROOT_BORDER_WIDTH,
            borderColor: DEFAULT_TRANSPARENT_COLOR,
          },
          "root"
        ),
        placement: normalizeMarginPlacement(
          payload.root?.margin,
          DEFAULT_BOX_FALLBACK,
          "root.margin",
          payload.root?.marginDesktop,
          "root.marginDesktop"
        ),
      },
      children: normalizeChildren(payload.root?.children, normalizeComponent).filter(
        (child): child is MessageComponentModel => child !== null
      ),
    },
    closeOptions,
    texts: payload.texts ?? {},
    urls: filterSafeURLEntries(payload.urls ?? {}),
    actions,
    eventData: payload.eventData ?? {},
    trackingId: payload.trackingId,
  };
}

function normalizeCloseOptions(payloadCloseOptions: MessagePayload["closeOptions"] | undefined): MessageCloseOptionsModel {
  const autoDelay = normalizeTimeInterval(payloadCloseOptions?.auto?.delay, DEFAULT_AUTO_CLOSE_DELAY);
  const auto =
    autoDelay > 0
      ? {
          delay: autoDelay,
          color: payloadCloseOptions?.auto?.color ? normalizeColor(payloadCloseOptions.auto.color, DEFAULT_FALLBACK_COLOR) : undefined,
        }
      : undefined;

  const button = payloadCloseOptions?.button
    ? {
        color: normalizeColor(payloadCloseOptions.button.color, DEFAULT_CLOSE_BUTTON_COLOR),
        backgroundColor: normalizeColor(payloadCloseOptions.button.backgroundColor, DEFAULT_CLOSE_BUTTON_BACKGROUND),
      }
    : DEFAULT_MODAL_CLOSE_BUTTON;

  return { auto, button };
}

function normalizeComponent(component: MessageComponentPayload): MessageComponentModel | null {
  switch (component.type) {
    case MessageComponentTypeValue.Button:
      return normalizeButton(component);
    case MessageComponentTypeValue.Text:
      return normalizeLabel(component);
    case MessageComponentTypeValue.Image:
      return normalizeImage(component);
    case MessageComponentTypeValue.Divider:
      return normalizeDivider(component);
    case MessageComponentTypeValue.Spacer:
      return normalizeSpacer(component);
    case MessageComponentTypeValue.Columns:
      return normalizeColumns(component, child => normalizeComponent(child));
    case MessageComponentTypeValue.Field:
      return normalizeInput(component);
    case MessageComponentTypeValue.Choice:
      return normalizeChoice(component);
    default:
      Log.warn(RENDER_LOG_MODULE, `[normalizer] unknown component type "${(component as { type?: unknown }).type}", ignoring it`);
      return null;
  }
}
