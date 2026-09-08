import { RENDER_LOG_MODULE, RENDER_MAPS_TO_HONEYPOT } from "com.batch.dom/render/render-constants";
import { Log } from "com.batch.shared/logger";

import { MessageBorderStyle, MessageInputModel, MessageTextConfiguration, MessageValidationModel } from "../model";
import {
  normalizeBorderStyleConfiguration,
  normalizeBox,
  normalizeColor,
  normalizeEnum,
  normalizeHorizontalAlignment,
  normalizeMarginPlacement,
  normalizeOptionalBox,
  normalizeOptionalColor,
  normalizeOptionalPositiveNumber,
  normalizeTextConfiguration,
} from "../normalize-helpers";
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
  DEFAULT_INPUT_TYPE,
  DEFAULT_TEXT_MAX_LINES,
} from "../normalizer-defaults";
import { MessageHorizontalAlignmentValue, MessageInputPayload, MessageInputTypeValue, MessageValidatablePayload } from "../types";

function normalizeValidatable(payload: MessageValidatablePayload): { required: boolean; validation?: MessageValidationModel } {
  return {
    required: payload.required === true,
    validation: normalizeValidation(payload.validation, "field.validation"),
  };
}

/** Longest payload regex accepted. Beyond this the source is dropped, not truncated. */
const MAX_VALIDATION_REGEX_LENGTH = 200;

function canBacktrackExponentially(source: string): boolean {
  // The root frame is never repeated, so `^a+|b+$` is not a finding.
  const stack: { ambiguous: boolean }[] = [{ ambiguous: false }];
  let inClass = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      inClass = char !== "]";
      continue;
    }
    if (char === "[") {
      inClass = true;
      continue;
    }
    if (char === "(") {
      // Skip the prefix, so the `?` of `(?:` never reads as a quantifier.
      i += groupPrefixLength(source, i);
      stack.push({ ambiguous: false });
      continue;
    }
    if (char === ")") {
      // Unbalanced: `RegExp()` rejects the source one branch below.
      if (stack.length === 1) {
        continue;
      }
      const closed = stack[stack.length - 1];
      stack.pop();
      const next = source[i + 1];
      if (closed.ambiguous && (next === "*" || next === "+" || next === "{")) {
        return true;
      }
      // `^((a|aa))+$` repeats the alternation through the outer group.
      if (closed.ambiguous) {
        stack[stack.length - 1].ambiguous = true;
      }
      continue;
    }
    if (char === "*" || char === "+" || char === "?" || char === "{" || char === "|") {
      stack[stack.length - 1].ambiguous = true;
    }
  }
  return false;
}

function groupPrefixLength(source: string, open: number): number {
  if (source[open + 1] !== "?") {
    return 0;
  }
  const third = source[open + 2];
  if (third === ":" || third === "=" || third === "!") {
    return 2;
  }
  if (third === "<") {
    const fourth = source[open + 3];
    if (fourth === "=" || fourth === "!") {
      return 3;
    }
    const end = source.indexOf(">", open + 3);
    return end === -1 ? 2 : end - open;
  }
  return 0;
}

function normalizeValidation(
  validation: { regex?: string; errorId?: string } | undefined,
  field: string
): MessageValidationModel | undefined {
  if (!validation || typeof validation !== "object") {
    return undefined;
  }
  const result: MessageValidationModel = {};
  if (typeof validation.regex === "string" && validation.regex.length > 0) {
    if (validation.regex.length > MAX_VALIDATION_REGEX_LENGTH) {
      Log.warn(RENDER_LOG_MODULE, `[normalizer] ${field}: validation regex longer than ${MAX_VALIDATION_REGEX_LENGTH} characters, ignored`);
    } else if (canBacktrackExponentially(validation.regex)) {
      Log.warn(RENDER_LOG_MODULE, `[normalizer] ${field}: validation regex can backtrack exponentially, ignored`);
    } else {
      try {
        RegExp(validation.regex);
        result.regex = validation.regex;
      } catch {
        Log.warn(RENDER_LOG_MODULE, `[normalizer] ${field}: invalid regex "${validation.regex}", ignored`);
      }
    }
  }
  if (typeof validation.errorId === "string" && validation.errorId.length > 0) {
    result.errorId = validation.errorId;
  }
  return result.regex === undefined && result.errorId === undefined ? undefined : result;
}

/** Width is a percentage of the available width. Only values above 0 and up to 100 are valid. */
function normalizeFieldWidth(value: number | undefined, field: string): number {
  if (value === undefined) return DEFAULT_FIELD_WIDTH;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] fallback for "${field}": invalid width ${JSON.stringify(value)}`);
    return DEFAULT_FIELD_WIDTH;
  }
  return value;
}

function normalizeFieldBorderStyle(payload: {
  backgroundColor?: MessageInputPayload["backgroundColor"];
  radius?: number[];
  borderWidth?: number;
  borderColor?: MessageInputPayload["borderColor"];
}): MessageBorderStyle {
  return normalizeBorderStyleConfiguration(
    {
      backgroundColor: payload.backgroundColor,
      radius: payload.radius,
      borderWidth: payload.borderWidth,
      borderColor: payload.borderColor,
    },
    {
      backgroundColor: DEFAULT_INPUT_BACKGROUND_COLOR,
      radius: DEFAULT_INPUT_RADIUS,
      borderWidth: DEFAULT_INPUT_BORDER_WIDTH,
      borderColor: DEFAULT_INPUT_BORDER_COLOR,
    },
    "field"
  );
}

function normalizeFieldTextConfiguration(payload: {
  textColor?: MessageInputPayload["textColor"];
  fontSize?: number;
  fontSizeDesktop?: number;
}): MessageTextConfiguration {
  return normalizeTextConfiguration(
    {
      align: MessageHorizontalAlignmentValue.Left,
      color: payload.textColor,
      maxLines: DEFAULT_TEXT_MAX_LINES,
      fontSize: payload.fontSize,
      fontSizeDesktop: payload.fontSizeDesktop,
    },
    {
      align: MessageHorizontalAlignmentValue.Left,
      color: DEFAULT_FALLBACK_COLOR,
      maxLines: DEFAULT_TEXT_MAX_LINES,
      fontSize: DEFAULT_FIELD_FONT_SIZE,
    },
    "field",
    "textColor"
  );
}

export function normalizeInput(component: MessageInputPayload): MessageInputModel | null {
  // Without `mapsTo` the field has no profile target, so drop it instead of rendering an input that leads nowhere.
  const mapsTo = typeof component.mapsTo === "string" ? component.mapsTo.trim() : "";
  if (mapsTo.length === 0) {
    Log.warn(RENDER_LOG_MODULE, `[normalizer] ignored field "${component.id}": missing "mapsTo"`);
    return null;
  }

  // `$honeypot` is reserved for the anti-bot decoy: a real field on that key would route every genuine submit to the bot topic.
  if (mapsTo === RENDER_MAPS_TO_HONEYPOT) {
    Log.warn(RENDER_LOG_MODULE, `[normalizer] ignored field "${component.id}": "${RENDER_MAPS_TO_HONEYPOT}" is reserved`);
    return null;
  }

  const textConfiguration = normalizeFieldTextConfiguration(component);
  const validatable = normalizeValidatable(component);

  // The contract forbids `hideOn` on a field: its value always takes part in the submit.
  if (component.hideOn !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "field.hideOn": not supported on fields`);
  }

  const minMax = normalizeMinMax(component.minMax);

  return {
    type: "field",
    id: component.id,
    mapsTo,
    required: validatable.required,
    validation: validatable.validation,
    configuration: {
      inputType: normalizeEnum(component.fieldType, MessageInputTypeValue, DEFAULT_INPUT_TYPE, "fieldType", "field.fieldType"),
      placeholderId:
        typeof component.placeholderId === "string" && component.placeholderId.length > 0 ? component.placeholderId : undefined,
      labelTextId: typeof component.labelTextId === "string" && component.labelTextId.length > 0 ? component.labelTextId : undefined,
      labelVisible: component.labelVisible !== false,
      minLength: minMax.minLength,
      maxLength: minMax.maxLength,
      labelFontSize: normalizeOptionalPositiveNumber(component.labelFontSize, "field.labelFontSize") ?? DEFAULT_FIELD_LABEL_FONT_SIZE,
      labelFontSizeDesktop: normalizeOptionalPositiveNumber(component.labelFontSizeDesktop, "field.labelFontSizeDesktop"),
      labelColor: normalizeColor(component.labelColor ?? component.textColor, DEFAULT_FALLBACK_COLOR, "field.labelColor"),
      placeholderColor: normalizeOptionalColor(component.placeholderColor, "field.placeholderColor"),
      width: normalizeFieldWidth(component.width, "field.width"),
      align: normalizeHorizontalAlignment(component.align, DEFAULT_HORIZONTAL_ALIGN, "field.align"),
      style: {
        ...normalizeFieldBorderStyle(component),
        ...textConfiguration.style,
      },
      fontStyle: textConfiguration.fontStyle,
      placement: {
        ...normalizeMarginPlacement(component.margin, DEFAULT_BOX_FALLBACK, "field.margin", component.marginDesktop, "field.marginDesktop"),
        padding: normalizeBox(component.padding, DEFAULT_BOX_FALLBACK, true, "field.padding"),
        paddingDesktop: normalizeOptionalBox(component.paddingDesktop, true, "field.paddingDesktop"),
      },
    },
  };
}

function normalizeMinMax(value: number[] | undefined): { minLength?: number; maxLength?: number } {
  if (value === undefined) {
    return {};
  }
  if (!Array.isArray(value) || value.length !== 2 || value.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "field.minMax": invalid pair ${JSON.stringify(value)}`);
    return {};
  }
  const min = Math.floor(value[0]);
  const max = Math.floor(value[1]);
  if (max > 0 && min > max) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "field.minMax": min ${min} exceeds max ${max}`);
    return {};
  }
  return {
    minLength: min > 0 ? min : undefined,
    maxLength: max > 0 ? max : undefined,
  };
}
