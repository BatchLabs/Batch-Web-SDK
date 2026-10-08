import { RENDER_LOG_MODULE, RENDER_MAPS_TO_HONEYPOT } from "com.batch.dom/render/render-constants";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { isInputAttributeType, PROFILE_ATTRIBUTE_TYPES } from "../attribute-kinds";
import { MessageBorderStyle, MessageInputModel, MessageTextConfiguration, MessageValidationModel } from "../model";
import {
  dropComponent,
  normalizeBorderStyleConfiguration,
  normalizeBoundsPair,
  normalizeBox,
  normalizeEnum,
  normalizeFieldLabel,
  normalizeHorizontalAlignment,
  normalizeMarginPlacement,
  normalizeOptionalBox,
  normalizeOptionalColor,
  normalizeTextConfiguration,
} from "../normalize-helpers";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FIELD_FONT_SIZE,
  DEFAULT_FIELD_WIDTH,
  DEFAULT_HORIZONTAL_ALIGN,
  DEFAULT_INPUT_BACKGROUND_COLOR,
  DEFAULT_INPUT_BORDER_COLOR,
  DEFAULT_INPUT_BORDER_WIDTH,
  DEFAULT_INPUT_RADIUS,
  DEFAULT_INPUT_TYPE,
  DEFAULT_TEXT_MAX_LINES,
} from "../normalizer-defaults";
import {
  MessageAttributeTypeValue,
  MessageComponentTypeValue,
  MessageHorizontalAlignmentValue,
  MessageInputPayload,
  MessageInputTypeValue,
  MessageValidatablePayload,
} from "../types";

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
    MessageComponentTypeValue.Field
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
    MessageComponentTypeValue.Field,
    "textColor"
  );
}

export function normalizeInput(component: MessageInputPayload): MessageInputModel | null {
  // Without `mapsTo` the field has no profile target, so drop it instead of rendering an input that leads nowhere.
  const mapsTo = typeof component.mapsTo === "string" ? component.mapsTo.trim() : "";
  if (mapsTo.length === 0) {
    return dropComponent(MessageComponentTypeValue.Field, component.id, 'missing "mapsTo"');
  }

  // `$honeypot` is reserved for the anti-bot decoy: a real field on that key would route every genuine submit to the bot topic.
  if (mapsTo === RENDER_MAPS_TO_HONEYPOT) {
    return dropComponent(MessageComponentTypeValue.Field, component.id, `"${RENDER_MAPS_TO_HONEYPOT}" is reserved`);
  }

  const inputType = normalizeEnum(component.fieldType, MessageInputTypeValue, DEFAULT_INPUT_TYPE, "fieldType", "field.fieldType");
  const word = normalizeEnum(
    component.attributeType,
    MessageAttributeTypeValue,
    MessageAttributeTypeValue.String,
    "attributeType",
    "field.attributeType"
  );
  const attributeType = PROFILE_ATTRIBUTE_TYPES[word];
  if (!isInputAttributeType(attributeType)) {
    return dropComponent(MessageComponentTypeValue.Field, component.id, `a field cannot write a ${word}`);
  }
  const isString = attributeType === ProfileAttributeType.STRING;
  if (!isString) {
    if (inputType !== MessageInputTypeValue.Text) {
      return dropComponent(MessageComponentTypeValue.Field, component.id, `a ${inputType} field cannot write a ${word}`);
    }
    if (mapsTo.charAt(0) === "$") {
      return dropComponent(MessageComponentTypeValue.Field, component.id, "a native attribute holds a string");
    }
  }

  const textConfiguration = normalizeFieldTextConfiguration(component);
  const validatable = normalizeValidatable(component);

  // The contract forbids `hideOn` on a field: its value always takes part in the submit.
  if (component.hideOn !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "field.hideOn": not supported on fields`);
  }

  // A length bound on a number, a date or a url would count its characters instead of bounding its value.
  if (!isString && component.minMax !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "field.minMax": not applicable to a ${word} field`);
  }
  const minMax = isString ? normalizeBoundsPair(component.minMax, "field.minMax") : {};

  return {
    type: MessageComponentTypeValue.Field,
    id: component.id,
    mapsTo,
    required: validatable.required,
    validation: validatable.validation,
    configuration: {
      inputType,
      attributeType,
      placeholderId:
        typeof component.placeholderId === "string" && component.placeholderId.length > 0 ? component.placeholderId : undefined,
      ...normalizeFieldLabel(component, MessageComponentTypeValue.Field, component.textColor),
      minLength: minMax.min,
      maxLength: minMax.max,
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
