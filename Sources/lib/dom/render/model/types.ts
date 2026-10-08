export const MessageFormatValue = {
  Modal: "modal",
  Fullscreen: "fullscreen",
} as const;

export const MessageVerticalAlignmentValue = {
  Top: "top",
  Center: "center",
  Bottom: "bottom",
} as const;

export const MessageHorizontalAlignmentValue = {
  Left: "left",
  Center: "center",
  Right: "right",
} as const;

export const MessageAspectRatioValue = {
  Fit: "fit",
  Fill: "fill",
} as const;

export const MessageInputTypeValue = {
  Text: "text",
  Phone: "phone",
  Email: "email",
} as const;

export const MessageHideOnValue = {
  Mobile: "mobile",
  Desktop: "desktop",
} as const;

export const MessageChoiceTypeValue = {
  Checkbox: "checkbox",
  Radio: "radio",
} as const;

export const MessageChoiceLayoutValue = {
  Vertical: "vertical",
  Horizontal: "horizontal",
} as const;

export const MessageComponentTypeValue = {
  Button: "button",
  Text: "text",
  Image: "image",
  Divider: "divider",
  Spacer: "spacer",
  Columns: "columns",
  Field: "field",
  Choice: "choice",
} as const;

export const MessageAttributeTypeValue = {
  String: "string",
  Boolean: "boolean",
  Integer: "integer",
  Float: "float",
  Date: "date",
  Url: "url",
  Array: "array",
} as const;

export type MessageFormat = (typeof MessageFormatValue)[keyof typeof MessageFormatValue];
export type MessageVerticalAlignment = (typeof MessageVerticalAlignmentValue)[keyof typeof MessageVerticalAlignmentValue];
export type MessageHorizontalAlignment = (typeof MessageHorizontalAlignmentValue)[keyof typeof MessageHorizontalAlignmentValue];
export type MessageAspectRatio = (typeof MessageAspectRatioValue)[keyof typeof MessageAspectRatioValue];
export type MessageInputType = (typeof MessageInputTypeValue)[keyof typeof MessageInputTypeValue];
export type MessageHideOn = (typeof MessageHideOnValue)[keyof typeof MessageHideOnValue];
export type MessageChoiceType = (typeof MessageChoiceTypeValue)[keyof typeof MessageChoiceTypeValue];
export type MessageChoiceLayout = (typeof MessageChoiceLayoutValue)[keyof typeof MessageChoiceLayoutValue];
export type MessageAttributeType = (typeof MessageAttributeTypeValue)[keyof typeof MessageAttributeTypeValue];
export type MessageComponentType = (typeof MessageComponentTypeValue)[keyof typeof MessageComponentTypeValue];

/** Runtime check for the `format` field of an incoming payload. */
export function isMessageFormat(value: unknown): value is MessageFormat {
  return (Object.values(MessageFormatValue) as unknown[]).includes(value);
}

// Colors are [light] or [light, dark]
export type MessageColor = [string] | [string, string];

export interface MessagePayload {
  format: MessageFormat;
  minMLvl?: number;
  position?: MessageVerticalAlignment;
  root: MessageRootContainerPayload;
  closeOptions?: MessageCloseOptionPayload;
  texts?: Record<string, string>;
  urls?: Record<string, string>;
  actions?: Record<string, MessageAction>;
  eventData?: Record<string, string>;
  trackingId?: string;
}

export interface MessageRootContainerPayload {
  backgroundColor?: MessageColor;
  children: MessageComponentPayload[];
  margin?: [number, number, number, number];
  marginDesktop?: number[];
  radius?: number[];
  borderWidth?: number;
  borderColor?: MessageColor;
}

export interface MessageCloseOptionPayload {
  auto?: { delay: number; color?: MessageColor };
  button?: { color: MessageColor; backgroundColor?: MessageColor };
}

export interface MessageAction {
  action: string;
  params?: Record<string, unknown>;
}

export type MessageComponentPayload =
  | MessageButtonPayload
  | MessageLabelPayload
  | MessageImagePayload
  | MessageDividerPayload
  | MessageSpacerPayload
  | MessageColumnsPayload
  | MessageInputPayload
  | MessageChoicePayload;

/** Shared validation surface for form fields; `errorId` points to a key in `message.texts`. */
export interface MessageValidatablePayload {
  required?: boolean;
  validation?: { regex?: string; errorId?: string };
}

export interface MessageFieldLabelPayload {
  /** Key in `texts` that holds the label; absent or unresolved means no label. */
  labelTextId?: string | null;
  /** `false` hides the label visually; it stays in the DOM for the `label[for]` link. */
  labelVisible?: boolean;
  labelFontSize?: number;
  labelFontSizeDesktop?: number;
  labelColor?: MessageColor;
}

export interface MessageButtonPayload {
  type: typeof MessageComponentTypeValue.Button;
  id: string;
  margin?: number[];
  marginDesktop?: number[];
  padding?: number[];
  paddingDesktop?: number[];
  width?: string;
  align?: MessageHorizontalAlignment;
  backgroundColor?: MessageColor;
  radius?: number[];
  borderWidth?: number;
  borderColor?: MessageColor;
  fontSize?: number;
  fontSizeDesktop?: number;
  textAlign?: MessageHorizontalAlignment;
  textColor?: MessageColor;
  maxLines?: number;
  fontDecoration?: string[];
  hideOn?: MessageHideOn;
}

export interface MessageLabelPayload {
  type: typeof MessageComponentTypeValue.Text;
  id: string;
  margin?: number[];
  marginDesktop?: number[];
  textAlign?: MessageHorizontalAlignment;
  fontSize?: number;
  fontSizeDesktop?: number;
  color?: MessageColor;
  maxLines?: number;
  fontDecoration?: string[];
  hideOn?: MessageHideOn;
}

export interface MessageImagePayload {
  type: typeof MessageComponentTypeValue.Image;
  id: string;
  aspect?: MessageAspectRatio;
  margin?: number[];
  marginDesktop?: number[];
  height?: string;
  radius?: number[];
  accessibilityLabel?: string;
  hideOn?: MessageHideOn;
}

export interface MessageDividerPayload {
  type: typeof MessageComponentTypeValue.Divider;
  color?: MessageColor;
  thickness?: number;
  margin?: number[];
  marginDesktop?: number[];
  width?: string;
  align?: MessageHorizontalAlignment;
  hideOn?: MessageHideOn;
}

export interface MessageSpacerPayload {
  type: typeof MessageComponentTypeValue.Spacer;
  height?: string;
  hideOn?: MessageHideOn;
}

export interface MessageColumnsPayload {
  type: typeof MessageComponentTypeValue.Columns;
  children?: (MessageComponentPayload | null)[];
  ratios?: number[];
  margin?: number[];
  marginDesktop?: number[];
  padding?: number[];
  paddingDesktop?: number[];
  backgroundColor?: MessageColor;
  radius?: number[];
  spacing?: number;
  contentAlign?: MessageVerticalAlignment;
  hideOn?: MessageHideOn;
}

export interface MessageInputPayload extends MessageValidatablePayload, MessageFieldLabelPayload {
  type: typeof MessageComponentTypeValue.Field;
  id: string;
  /** Profile target of the field. A `$` prefix designates a native attribute; any other value is a custom attribute key. */
  mapsTo: string;
  fieldType?: MessageInputType;
  /**
   * Absent or unknown means `string`; `integer`, `float`, `date` and `url` need `fieldType: "text"` on a custom attribute;
   * `boolean` and `array` drop the field.
   */
  attributeType?: MessageAttributeType;
  placeholderId?: string | null;
  /** `[min, max]` accepted value length. The submit step enforces `min`. `max` caps the input. */
  minMax?: number[];
  margin?: number[];
  marginDesktop?: number[];
  padding?: number[];
  paddingDesktop?: number[];
  width?: number;
  /** Horizontal placement of the field inside its parent. It only applies on a width below 100. */
  align?: MessageHorizontalAlignment;
  fontSize?: number;
  fontSizeDesktop?: number;
  /** Placeholder color. If absent, the placeholder inherits `textColor` at reduced opacity. */
  placeholderColor?: MessageColor;
  textColor?: MessageColor;
  backgroundColor?: MessageColor;
  borderColor?: MessageColor;
  borderWidth?: number;
  radius?: number[];
  /** Fields do not support this property. The declaration lets the normalizer diagnose a stray value without a cast. */
  hideOn?: unknown;
}

export interface MessageChoiceValuePayload {
  /** Key in `texts` holding the option label, and stable part of its DOM id. */
  id: string;
  attributeValue: string;
  /** Pre-checked state; on a radio only the first `true` wins. */
  selected?: boolean;
}

export interface MessageChoicePayload extends MessageFieldLabelPayload {
  type: typeof MessageComponentTypeValue.Choice;
  id: string;
  /** Profile target of the selection; absent makes the choice a local barrier that validates but writes nothing. */
  mapsTo?: string;
  choiceType?: MessageChoiceType;
  /**
   * Declared, it wins and drops the choice its control cannot write; absent, it falls back to `string` for a radio,
   * `array` (or `boolean` on a single option) for a checkbox. An option that is not a value of the resolved type is dropped alone.
   */
  attributeType?: MessageAttributeType;
  values?: (MessageChoiceValuePayload | null)[];
  required?: boolean;
  /** `[min, max]` selected values, 0 meaning no constraint; only an `array` choice reads it. */
  minMax?: number[];
  layout?: MessageChoiceLayout;
  /** Horizontal placement of the options inside the choice; the box always precedes its text. */
  align?: MessageHorizontalAlignment;
  spacing?: number;
  margin?: number[];
  marginDesktop?: number[];
  checkedColor?: MessageColor;
  borderColor?: MessageColor;
  fontSize?: number;
  fontSizeDesktop?: number;
  textColor?: MessageColor;
  /** Choices do not support this property. The declaration lets the normalizer diagnose a stray value without a cast. */
  hideOn?: unknown;
  validation?: unknown;
}
