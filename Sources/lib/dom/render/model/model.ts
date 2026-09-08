import type {
  MessageAction,
  MessageAspectRatio as MessageAspectRatioType,
  MessageColor,
  MessageFormat,
  MessageHideOn,
  MessageHorizontalAlignment,
  MessageInputType,
  MessageVerticalAlignment,
} from "./types";

export type MessageColorScheme = "light" | "dark";
export type MessageFontDecoration = "bold" | "italic" | "underline" | "stroke";
export type MessageBox = [number, number, number, number];
export const MessageHeightValue = {
  Fill: "fill",
  Auto: "auto",
} as const;
export const MessageWidthValue = {
  Fill: "fill",
} as const;
export type MessageHeightType = (typeof MessageHeightValue)[keyof typeof MessageHeightValue] | { px: number };
export type MessageWidthType = (typeof MessageWidthValue)[keyof typeof MessageWidthValue] | { px: number } | { percent: number };
export type MessageAspectRatio = MessageAspectRatioType;

export interface MessageFontStyle {
  fontSize: number;
  fontSizeDesktop?: number;
  fontDecoration: MessageFontDecoration[];
}

export interface MessageTextStyleModel {
  align: MessageHorizontalAlignment;
  color: MessageColor;
  maxLines: number;
}

/** Normalized text styling. `style` holds layout, `fontStyle` holds typography. */
export interface MessageTextConfiguration {
  style: MessageTextStyleModel;
  fontStyle: MessageFontStyle;
}

export interface MessageBorderStyle {
  backgroundColor: MessageColor;
  radius: MessageBox;
  borderWidth: number;
  borderColor: MessageColor;
}

export interface MessageMarginPlacement {
  margin: MessageBox;
  marginDesktop?: MessageBox;
}

/** Mixin that hides a component on one side of the responsive breakpoint. */
export interface MessageHideable {
  hideOn?: MessageHideOn;
}

export interface MessageValidationModel {
  regex?: string;
  errorId?: string;
}

export interface MessageValidatable {
  validation?: MessageValidationModel;
}

export interface MessageRequired {
  required: boolean;
}

export interface MessageModel {
  format: MessageFormat;
  minMLvl?: number;
  position: MessageVerticalAlignment;
  root: MessageRootModel;
  closeOptions: MessageCloseOptionsModel;
  texts: Record<string, string>;
  urls: Record<string, string>;
  actions: Record<string, MessageAction>;
  eventData: Record<string, string>;
  trackingId?: string;
}

export interface MessageRootModel {
  configuration: RootConfiguration;
  children: MessageAnyComponentModel[];
}

export interface RootConfiguration {
  style: MessageBorderStyle;
  placement: MessageMarginPlacement;
}

export interface MessageCloseOptionsModel {
  auto?: {
    delay: number;
    color?: MessageColor;
  };
  button?: {
    color: MessageColor;
    backgroundColor?: MessageColor;
  };
}

export type MessageAnyComponentModel =
  | MessageButtonModel
  | MessageLabelModel
  | MessageImageModel
  | MessageDividerModel
  | MessageSpacerModel
  | MessageColumnsModel
  | MessageInputModel;

export interface MessageButtonModel extends MessageHideable {
  type: "button";
  id: string;
  configuration: {
    // `contentRef` and `actionRef` mirror `id`, kept distinct for model parity with iOS and Android.
    contentRef: string;
    actionRef: string;
    style: MessageBorderStyle & MessageTextStyleModel;
    fontStyle: MessageFontStyle;
    placement: MessageMarginPlacement & {
      padding: MessageBox;
      paddingDesktop?: MessageBox;
      width: MessageWidthType;
      align: MessageHorizontalAlignment;
    };
  };
}

export interface MessageLabelModel extends MessageHideable {
  type: "text";
  id: string;
  configuration: {
    contentRef: string;
    style: MessageTextStyleModel;
    fontStyle: MessageFontStyle;
    placement: MessageMarginPlacement;
  };
}

export interface MessageImageModel extends MessageHideable {
  type: "image";
  id: string;
  configuration: {
    contentRef: string;
    style: {
      aspect: MessageAspectRatio;
      radius: MessageBox;
    };
    placement: MessageMarginPlacement & {
      height: MessageHeightType;
    };
    accessibility: {
      label?: string;
    };
  };
}

export interface MessageDividerModel extends MessageHideable {
  type: "divider";
  configuration: {
    style: {
      color: MessageColor;
      thickness: number;
    };
    placement: MessageMarginPlacement & {
      width: MessageWidthType;
      align: MessageHorizontalAlignment;
    };
  };
}

export interface MessageSpacerModel extends MessageHideable {
  type: "spacer";
  configuration: {
    placement: {
      height: MessageHeightType;
    };
  };
}

export interface MessageColumnsModel extends MessageHideable {
  type: "columns";
  configuration: {
    style: {
      spacing: number;
      contentAlign: MessageVerticalAlignment;
      backgroundColor: MessageColor;
      radius: MessageBox;
    };
    placement: MessageMarginPlacement & {
      padding: MessageBox;
      paddingDesktop?: MessageBox;
    };
    ratios: number[];
    children: (MessageAnyComponentModel | null)[];
  };
}

export interface MessageInputModel extends MessageValidatable, MessageRequired {
  type: "field";
  id: string;
  /** Profile target of the submitted value. A `$` prefix designates a native attribute. See `MessageInputPayload.mapsTo`. */
  mapsTo: string;
  configuration: {
    inputType: MessageInputType;
    /** Key in `message.texts` holding the placeholder; absent means no placeholder. */
    placeholderId?: string;
    /** Key in `message.texts` holding the label; absent means no label is rendered. */
    labelTextId?: string;
    /** `false` hides the label visually. It stays in the DOM for the `label[for]` link, and the placeholder names the field. */
    labelVisible: boolean;
    /** Minimum accepted value length, from `minMax[0]`. The submit step enforces it like `required`. */
    minLength?: number;
    /** Maximum accepted value length, from `minMax[1]`. It caps the input characters. */
    maxLength?: number;
    labelFontSize: number;
    labelFontSizeDesktop?: number;
    labelColor: MessageColor;
    /** Placeholder color, applied as-is. If absent, the placeholder inherits the text color at reduced opacity. */
    placeholderColor?: MessageColor;
    /** Field width as a percentage of the available width. Valid values are above 0 and up to 100. */
    width: number;
    /** Horizontal placement of the field inside its parent. A full width ignores it and stretches. */
    align: MessageHorizontalAlignment;
    style: MessageBorderStyle & MessageTextStyleModel;
    fontStyle: MessageFontStyle;
    placement: MessageMarginPlacement & {
      padding: MessageBox;
      paddingDesktop?: MessageBox;
    };
  };
}
