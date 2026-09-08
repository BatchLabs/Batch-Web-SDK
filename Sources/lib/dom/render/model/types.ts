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

export type MessageFormat = (typeof MessageFormatValue)[keyof typeof MessageFormatValue];
export type MessageVerticalAlignment = (typeof MessageVerticalAlignmentValue)[keyof typeof MessageVerticalAlignmentValue];
export type MessageHorizontalAlignment = (typeof MessageHorizontalAlignmentValue)[keyof typeof MessageHorizontalAlignmentValue];
export type MessageAspectRatio = (typeof MessageAspectRatioValue)[keyof typeof MessageAspectRatioValue];
export type MessageInputType = (typeof MessageInputTypeValue)[keyof typeof MessageInputTypeValue];
export type MessageHideOn = (typeof MessageHideOnValue)[keyof typeof MessageHideOnValue];

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
  children: MessageAnyComponentPayload[];
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

export type MessageAnyComponentPayload =
  | MessageButtonPayload
  | MessageLabelPayload
  | MessageImagePayload
  | MessageDividerPayload
  | MessageSpacerPayload
  | MessageColumnsPayload
  | MessageInputPayload;

/** Shared validation surface for form fields; `errorId` points to a key in `message.texts`. */
export interface MessageValidatablePayload {
  required?: boolean;
  validation?: { regex?: string; errorId?: string };
}

export interface MessageButtonPayload {
  type: "button";
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
  type: "text";
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
  type: "image";
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
  type: "divider";
  color?: MessageColor;
  thickness?: number;
  margin?: number[];
  marginDesktop?: number[];
  width?: string;
  align?: MessageHorizontalAlignment;
  hideOn?: MessageHideOn;
}

export interface MessageSpacerPayload {
  type: "spacer";
  height?: string;
  hideOn?: MessageHideOn;
}

export interface MessageColumnsPayload {
  type: "columns";
  children?: (MessageAnyComponentPayload | null)[];
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

export interface MessageInputPayload extends MessageValidatablePayload {
  type: "field";
  id: string;
  /** Profile target of the field. A `$` prefix designates a native attribute; any other value is a custom attribute key. */
  mapsTo: string;
  fieldType?: MessageInputType;
  placeholderId?: string | null;
  /** Key in `texts` that holds the label. If absent or unresolved, the field shows no label. */
  labelTextId?: string | null;
  /** `false` hides the label visually. It stays in the DOM for the `label[for]` link, and the placeholder names the field. */
  labelVisible?: boolean;
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
  labelFontSize?: number;
  labelFontSizeDesktop?: number;
  labelColor?: MessageColor;
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
