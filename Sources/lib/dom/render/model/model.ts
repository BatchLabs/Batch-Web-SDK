import type { MessageInputAttributeType, MessageProfileAttributeType } from "./attribute-kinds";
import type {
  MessageAction,
  MessageAspectRatio as MessageAspectRatioType,
  MessageChoiceLayout,
  MessageChoiceType,
  MessageColor,
  MessageComponentTypeValue,
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

export interface MessageFieldLabel {
  /** Key in `message.texts` holding the label; absent means no label is rendered. */
  labelTextId?: string;
  labelVisible: boolean;
  labelFontSize: number;
  labelFontSizeDesktop?: number;
  labelColor: MessageColor;
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
  children: MessageComponentModel[];
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

export type MessageComponentModel =
  | MessageButtonModel
  | MessageLabelModel
  | MessageImageModel
  | MessageDividerModel
  | MessageSpacerModel
  | MessageColumnsModel
  | MessageInputModel
  | MessageChoiceModel;

export interface MessageButtonModel extends MessageHideable {
  type: typeof MessageComponentTypeValue.Button;
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
  type: typeof MessageComponentTypeValue.Text;
  id: string;
  configuration: {
    contentRef: string;
    style: MessageTextStyleModel;
    fontStyle: MessageFontStyle;
    placement: MessageMarginPlacement;
  };
}

export interface MessageImageModel extends MessageHideable {
  type: typeof MessageComponentTypeValue.Image;
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
  type: typeof MessageComponentTypeValue.Divider;
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
  type: typeof MessageComponentTypeValue.Spacer;
  configuration: {
    placement: {
      height: MessageHeightType;
    };
  };
}

export interface MessageColumnsModel extends MessageHideable {
  type: typeof MessageComponentTypeValue.Columns;
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
    children: (MessageComponentModel | null)[];
  };
}

export interface MessageInputModel extends MessageValidatable, MessageRequired {
  type: typeof MessageComponentTypeValue.Field;
  id: string;
  /** Profile target of the submitted value. A `$` prefix designates a native attribute. See `MessageInputPayload.mapsTo`. */
  mapsTo: string;
  configuration: MessageFieldLabel & {
    inputType: MessageInputType;
    attributeType: MessageInputAttributeType;
    /** Key in `message.texts` holding the placeholder; absent means no placeholder. */
    placeholderId?: string;
    /** Minimum accepted value length, from `minMax[0]`. The submit step enforces it like `required`. */
    minLength?: number;
    /** Maximum accepted value length, from `minMax[1]`. It caps the input characters. */
    maxLength?: number;
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

export interface MessageChoiceValueModel {
  id: string;
  attributeValue: string;
  selected: boolean;
}

export interface MessageChoiceModel extends MessageRequired {
  type: typeof MessageComponentTypeValue.Choice;
  id: string;
  mapsTo?: string;
  configuration: MessageFieldLabel & {
    choiceType: MessageChoiceType;
    attributeType: MessageProfileAttributeType;
    /** Kept options in payload order: at least 2 on a radio, 1 on a boolean checkbox, 1 to `Consts.MaxEventArrayItems` on an array. */
    values: MessageChoiceValueModel[];
    /** Fewest checked options the submit accepts. Only an `array` choice carries it. */
    minSelected?: number;
    /** Most options the group lets the user check. */
    maxSelected?: number;
    layout: MessageChoiceLayout;
    align: MessageHorizontalAlignment;
    spacing: number;
    checkedColor: MessageColor;
    borderColor: MessageColor;
    textColor: MessageColor;
    fontStyle: MessageFontStyle;
    placement: MessageMarginPlacement;
  };
}
