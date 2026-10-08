import { RENDER_LOG_MODULE } from "com.batch.dom/render/render-constants";
import { Log } from "com.batch.shared/logger";

import {
  MessageComponentModel,
  MessageBorderStyle,
  MessageBox,
  MessageFieldLabel,
  MessageFontDecoration,
  MessageHeightType,
  MessageHeightValue,
  MessageMarginPlacement,
  MessageTextConfiguration,
  MessageWidthType,
  MessageWidthValue,
} from "./model";
import { DEFAULT_FALLBACK_COLOR, DEFAULT_FIELD_LABEL_FONT_SIZE } from "./normalizer-defaults";
import {
  MessageComponentPayload,
  MessageAspectRatio,
  MessageAspectRatioValue,
  MessageColor,
  MessageComponentType,
  MessageFieldLabelPayload,
  MessageHideOn,
  MessageHideOnValue,
  MessageHorizontalAlignment,
  MessageHorizontalAlignmentValue,
  MessageVerticalAlignment,
  MessageVerticalAlignmentValue,
} from "./types";

const FONT_DECORATIONS = new Set<string>(["bold", "italic", "underline", "stroke"]);

function isFontDecoration(value: unknown): value is MessageFontDecoration {
  return typeof value === "string" && FONT_DECORATIONS.has(value);
}

/** Validates a value against a string-enum object and falls back to the default. */
export function normalizeEnum<T extends string>(value: unknown, allowed: Record<string, T>, fallback: T, kind: string, field?: string): T {
  if (typeof value === "string" && (Object.values(allowed) as string[]).includes(value)) {
    return value as T;
  }
  if (field !== undefined && value !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] fallback for "${field}": invalid ${kind} "${value}"`);
  }
  return fallback;
}

/** Like `normalizeEnum`, but an unmatched value resolves to `undefined`. */
export function normalizeOptionalEnum<T extends string>(
  value: unknown,
  allowed: Record<string, T>,
  kind: string,
  field?: string
): T | undefined {
  if (typeof value === "string" && (Object.values(allowed) as string[]).includes(value)) {
    return value as T;
  }
  if (value !== undefined && field !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${field}": invalid ${kind} ${JSON.stringify(value)}`);
  }
  return undefined;
}

interface NormalizeBorderStyleOptions {
  backgroundColor?: MessageColor;
  radius?: number[];
  borderWidth?: number;
  borderColor?: MessageColor;
}

interface NormalizeBorderStyleDefaults {
  backgroundColor: [string, string];
  radius: number;
  borderWidth: number;
  borderColor: [string, string];
}

interface NormalizeTextConfigurationOptions {
  align?: MessageHorizontalAlignment;
  color?: MessageColor;
  maxLines?: number;
  fontSize?: number;
  fontSizeDesktop?: number;
  fontDecoration?: string[];
}

interface NormalizeTextConfigurationDefaults {
  align: MessageHorizontalAlignment;
  color: [string, string];
  maxLines: number;
  fontSize: number;
}

/** Normalizes the shared border style surface; the component prefix builds the diagnostic labels. */
export function normalizeBorderStyleConfiguration(
  options: NormalizeBorderStyleOptions,
  defaults: NormalizeBorderStyleDefaults,
  component: string
): MessageBorderStyle {
  return {
    backgroundColor: normalizeColor(options.backgroundColor, defaults.backgroundColor, `${component}.backgroundColor`),
    radius: normalizeRadius(options.radius, defaults.radius, `${component}.radius`),
    borderWidth: normalizeNumber(options.borderWidth, defaults.borderWidth, false, `${component}.borderWidth`),
    borderColor: normalizeColor(options.borderColor, defaults.borderColor, `${component}.borderColor`),
  };
}

export function normalizeMarginPlacement(
  margin: number[] | undefined,
  fallback: number,
  field?: string,
  marginDesktop?: number[],
  desktopField?: string
): MessageMarginPlacement {
  return {
    margin: normalizeBox(margin, fallback, true, field),
    marginDesktop: normalizeOptionalBox(marginDesktop, true, desktopField),
  };
}

/** Normalizes an optional box override; an absent or invalid value resolves to `undefined`. */
export function normalizeOptionalBox(values: number[] | undefined, acceptNegativeValue: boolean, field?: string): MessageBox | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length === 0 || values.some(v => typeof v !== "number" || !Number.isFinite(v))) {
    if (field !== undefined) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${field}": invalid box ${JSON.stringify(values)}`);
    }
    return undefined;
  }
  return normalizeBox(values, 0, acceptNegativeValue, field);
}

/** Normalizes an optional positive number override; invalid or negative values resolve to `undefined`. */
export function normalizeOptionalPositiveNumber(value: number | undefined, field?: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    if (field !== undefined) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${field}": invalid number ${JSON.stringify(value)}`);
    }
    return undefined;
  }
  return Math.floor(value);
}

/** Only `"mobile"` and `"desktop"` are valid. Any other value means "visible everywhere". */
export function normalizeHideOn(value: unknown, field?: string): MessageHideOn | undefined {
  return normalizeOptionalEnum(value, MessageHideOnValue, "hideOn", field);
}

/** Normalizes the shared text style and font surface; `colorKey` selects the color payload key. */
export function normalizeTextConfiguration(
  options: NormalizeTextConfigurationOptions,
  defaults: NormalizeTextConfigurationDefaults,
  component: string,
  colorKey: "color" | "textColor" = "color"
): MessageTextConfiguration {
  return {
    style: {
      align: normalizeHorizontalAlignment(options.align, defaults.align, `${component}.textAlign`),
      color: normalizeColor(options.color, defaults.color, `${component}.${colorKey}`),
      maxLines: normalizeNumber(options.maxLines, defaults.maxLines, true, `${component}.maxLines`),
    },
    fontStyle: {
      fontSize: normalizeNumber(options.fontSize, defaults.fontSize, false, `${component}.fontSize`),
      fontSizeDesktop: normalizeOptionalPositiveNumber(options.fontSizeDesktop, `${component}.fontSizeDesktop`),
      fontDecoration: normalizeFontDecoration(options.fontDecoration),
    },
  };
}

/** `labelColor` falls back to the component's own text color before the generic fallback. */
export function normalizeFieldLabel(
  options: MessageFieldLabelPayload,
  component: MessageComponentType,
  inheritedColor?: MessageColor
): MessageFieldLabel {
  return {
    labelTextId: typeof options.labelTextId === "string" && options.labelTextId.length > 0 ? options.labelTextId : undefined,
    labelVisible: options.labelVisible !== false,
    labelFontSize: normalizeOptionalPositiveNumber(options.labelFontSize, `${component}.labelFontSize`) ?? DEFAULT_FIELD_LABEL_FONT_SIZE,
    labelFontSizeDesktop: normalizeOptionalPositiveNumber(options.labelFontSizeDesktop, `${component}.labelFontSizeDesktop`),
    labelColor: normalizeColor(options.labelColor ?? inheritedColor, DEFAULT_FALLBACK_COLOR, `${component}.labelColor`),
  };
}

/** Warns and drops a component the payload cannot render. */
export function dropComponent(kind: MessageComponentType, id: string, reason: string): null {
  Log.warn(RENDER_LOG_MODULE, `[normalizer] ignored ${kind} "${id}": ${reason}`);
  return null;
}

/** `0` means "no constraint" on either bound, and an incoherent pair is dropped whole. */
export function normalizeBoundsPair(value: number[] | undefined, field: string): { min?: number; max?: number } {
  if (value === undefined) {
    return {};
  }
  if (!Array.isArray(value) || value.length !== 2 || value.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${field}": invalid pair ${JSON.stringify(value)}`);
    return {};
  }
  const min = Math.floor(value[0]);
  const max = Math.floor(value[1]);
  if (max > 0 && min > max) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${field}": min ${min} exceeds max ${max}`);
    return {};
  }
  return { min: min > 0 ? min : undefined, max: max > 0 ? max : undefined };
}

/** Normalizes children keeping positional slots: the columns ratio list is index-aligned with its children. */
export function normalizeChildren(
  children: unknown,
  normalizeChild: (component: MessageComponentPayload) => MessageComponentModel | null
): (MessageComponentModel | null)[] {
  if (!Array.isArray(children)) {
    return [];
  }
  return children.map(child => (child !== null && typeof child === "object" ? normalizeChild(child as MessageComponentPayload) : null));
}

export function normalizeRatios(ratios: number[] | undefined, count: number): number[] {
  if (count <= 0) return [];
  if (ratios && ratios.length === count) {
    // flex-grow accepts fractional weights, so any finite positive number is valid; a bad ratio forces equal distribution.
    const validRatios = ratios.map(r => (typeof r === "number" && Number.isFinite(r) ? r : 0));
    if (validRatios.every(r => r > 0)) return validRatios;
    Log.warn(RENDER_LOG_MODULE, `[normalizer] columns ratios ignored (non-positive values), falling back to equal distribution`);
  } else if (ratios !== undefined) {
    Log.warn(
      RENDER_LOG_MODULE,
      `[normalizer] columns ratios length mismatch (got ${ratios.length}, expected ${count}), falling back to equal distribution`
    );
  }

  const base = Math.floor(100 / count);
  const computed = Array.from({ length: count }, () => base);
  const remainder = 100 - base * count;
  computed[count - 1] = computed[count - 1] + remainder;
  return computed;
}

export function normalizeFontDecoration(input: string[] | undefined): MessageFontDecoration[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<MessageFontDecoration>();
  for (const value of input) {
    if (isFontDecoration(value)) {
      unique.add(value);
    }
  }
  return Array.from(unique.values());
}

export function normalizeVerticalAlignment(
  value: MessageVerticalAlignment | undefined,
  fallback: MessageVerticalAlignment,
  field?: string
): MessageVerticalAlignment {
  return normalizeEnum(value, MessageVerticalAlignmentValue, fallback, "vertical alignment", field);
}

export function normalizeHorizontalAlignment(
  value: MessageHorizontalAlignment | undefined,
  fallback: MessageHorizontalAlignment,
  field?: string
): MessageHorizontalAlignment {
  return normalizeEnum(value, MessageHorizontalAlignmentValue, fallback, "horizontal alignment", field);
}

export function parseAspectRatio(value: string | undefined, fallback: MessageAspectRatio, field?: string): MessageAspectRatio {
  return normalizeEnum(value, MessageAspectRatioValue, fallback, "aspect ratio", field);
}

export function parseHeight(value: string | undefined, fallback: MessageHeightType, field?: string): MessageHeightType {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed === MessageHeightValue.Fill || trimmed === MessageHeightValue.Auto) return trimmed;

  const pxMatch = /^(\d+(?:\.\d+)?)px$/.exec(trimmed);
  if (!pxMatch) {
    if (field !== undefined) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] fallback for "${field}": invalid height "${value}"`);
    }
    return fallback;
  }

  return { px: Number.parseFloat(pxMatch[1]) };
}

export function parseWidth(value: string | undefined, fallback: MessageWidthType, field?: string): MessageWidthType {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed === MessageWidthValue.Fill) return trimmed;

  const pxMatch = /^(\d+(?:\.\d+)?)px$/.exec(trimmed);
  if (pxMatch) return { px: Number.parseFloat(pxMatch[1]) };

  const percentMatch = /^(\d+(?:\.\d+)?)%$/.exec(trimmed);
  if (percentMatch) return { percent: Number.parseFloat(percentMatch[1]) };

  if (field !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] fallback for "${field}": invalid width "${value}"`);
  }
  return fallback;
}

export function normalizeColor(value: MessageColor | undefined, fallback: [string, string], field?: string): MessageColor {
  const fallbackLightRaw = normalizeColorChannel(fallback[0]);
  const fallbackDarkRaw = normalizeColorChannel(fallback[1]);
  const fallbackLight = fallbackLightRaw ?? fallbackDarkRaw ?? "#000000FF";
  const fallbackDark = fallbackDarkRaw ?? fallbackLightRaw ?? fallbackLight;

  const light = normalizeColorChannel(value?.[0]);
  const dark = normalizeColorChannel(value?.[1]);

  if (light && dark) return [light, dark];
  if (light) return [light, light];
  if (dark) return [dark, dark];
  if (field !== undefined && value !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] fallback for "${field}": invalid color ${JSON.stringify(value)}`);
  }
  return [fallbackLight, fallbackDark];
}

/** Like `normalizeColor` but without a fallback: an absent or invalid tuple stays absent. */
export function normalizeOptionalColor(value: MessageColor | undefined, field?: string): MessageColor | undefined {
  if (value === undefined) return undefined;

  const light = normalizeColorChannel(value?.[0]);
  const dark = normalizeColorChannel(value?.[1]);

  if (light && dark) return [light, dark];
  if (light) return [light, light];
  if (dark) return [dark, dark];
  if (field !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${field}": invalid color ${JSON.stringify(value)}`);
  }
  return undefined;
}

export function normalizeRadius(values: number[] | undefined, fallback: number, field?: string): MessageBox {
  return normalizeBox(values, fallback, false, field);
}

export function normalizeBox(values: number[] | undefined, fallback: number, acceptNegativeValue: boolean, field?: string): MessageBox {
  const expanded = expandBox(values, fallback);
  return [
    normalizeNumber(expanded[0], fallback, acceptNegativeValue, field ? `${field}[0]` : undefined),
    normalizeNumber(expanded[1], fallback, acceptNegativeValue, field ? `${field}[1]` : undefined),
    normalizeNumber(expanded[2], fallback, acceptNegativeValue, field ? `${field}[2]` : undefined),
    normalizeNumber(expanded[3], fallback, acceptNegativeValue, field ? `${field}[3]` : undefined),
  ];
}

export function normalizeNumber(value: number | undefined, fallback: number, acceptNegativeValue: boolean, field?: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    if (field !== undefined && value !== undefined) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] fallback for "${field}": invalid number ${JSON.stringify(value)}`);
    }
    return fallback;
  }
  const floored = Math.floor(value);
  if (!acceptNegativeValue && floored < 0) {
    if (field !== undefined) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] fallback for "${field}": negative value ${value} not allowed`);
    }
    return fallback;
  }
  return floored;
}

export function normalizeTimeInterval(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value > 0 ? value : fallback;
}

function normalizeColorChannel(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return isLikelyColorString(trimmed) ? trimmed : undefined;
}

function isLikelyColorString(value: string): boolean {
  if (value.startsWith("#")) {
    return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value);
  }
  // Bare keyword or functional notation only: the safe character set blocks url(), attr() and var() injection.
  if (/^(transparent|currentcolor)$/i.test(value)) return true;
  return /^(rgb|rgba|hsl|hsla|oklch|lch|lab|color)\(\s*[0-9a-zA-Z ,./%+-]*\s*\)$/i.test(value);
}

function expandBox(values: number[] | undefined, fallback: number): [number, number, number, number] {
  if (!values || values.length === 0) return [fallback, fallback, fallback, fallback];
  if (values.length === 1) return [values[0], values[0], values[0], values[0]];
  if (values.length === 2) return [values[0], values[1], values[0], values[1]];
  if (values.length === 3) return [values[0], values[1], values[2], values[1]];
  return [values[0], values[1], values[2], values[3]];
}
