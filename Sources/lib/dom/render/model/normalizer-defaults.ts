import { MessageHeightType, MessageHeightValue, MessageWidthType } from "./model";
import type { MessageColor, MessageInputType } from "./types";
import {
  MessageAspectRatioValue,
  MessageFormatValue,
  MessageHorizontalAlignmentValue,
  MessageInputTypeValue,
  MessageVerticalAlignmentValue,
} from "./types";

export const DEFAULT_FALLBACK_COLOR: [string, string] = ["#000000FF", "#FFFFFFFF"];
export const DEFAULT_TRANSPARENT_COLOR: [string, string] = ["#00000000", "#00000000"];
export const DEFAULT_ROOT_BACKGROUND_COLOR: [string, string] = ["#FFFFFFFF", "#000000FF"];

export const DEFAULT_CLOSE_BUTTON_COLOR: [string, string] = ["#292945ff", "#7575ffff"];
export const DEFAULT_CLOSE_BUTTON_BACKGROUND: [string, string] = ["#ebebebff", "#4d4d4dff"];

export const DEFAULT_FORMAT = MessageFormatValue.Fullscreen;
export const DEFAULT_MODAL_POSITION = MessageVerticalAlignmentValue.Center;
export const DEFAULT_FULLSCREEN_POSITION = MessageVerticalAlignmentValue.Top;
// Placement of a button, a divider or a field inside its parent. `DEFAULT_TEXT_ALIGN` is the text alignment.
export const DEFAULT_HORIZONTAL_ALIGN = MessageHorizontalAlignmentValue.Center;
export const DEFAULT_TEXT_ALIGN = MessageHorizontalAlignmentValue.Center;
export const DEFAULT_CONTENT_ALIGN = MessageVerticalAlignmentValue.Center;
export const DEFAULT_IMAGE_ASPECT_RATIO = MessageAspectRatioValue.Fill;

export const DEFAULT_BUTTON_WIDTH: MessageWidthType = { percent: 100 };
export const DEFAULT_DIVIDER_WIDTH: MessageWidthType = { percent: 100 };
export const DEFAULT_IMAGE_HEIGHT = MessageHeightValue.Auto;
export const DEFAULT_SPACER_HEIGHT: MessageHeightType = { px: 0 };

export const DEFAULT_MODAL_CLOSE_BUTTON: Readonly<{ color: MessageColor; backgroundColor: MessageColor }> = Object.freeze({
  color: ["#000000FF", "#F3F3F3FF"],
  backgroundColor: ["#0000001A", "#FFFFFF1F"],
});

export const DEFAULT_ROOT_RADIUS = 0;
export const DEFAULT_ROOT_BORDER_WIDTH = 0;
export const DEFAULT_BOX_FALLBACK = 0;
export const DEFAULT_AUTO_CLOSE_DELAY = 0;
export const DEFAULT_BUTTON_RADIUS = 4;
export const DEFAULT_BUTTON_BORDER_WIDTH = 0;
export const DEFAULT_TEXT_MAX_LINES = 0;
export const DEFAULT_FONT_SIZE = 12;
export const DEFAULT_IMAGE_RADIUS = 0;
export const DEFAULT_DIVIDER_THICKNESS = 2;
export const DEFAULT_COLUMNS_SPACING = 0;
export const DEFAULT_LAYOUT_RADIUS = 0;

export const DEFAULT_INPUT_TYPE: MessageInputType = MessageInputTypeValue.Text;
// 16px avoids the iOS Safari auto-zoom on focus.
export const DEFAULT_FIELD_FONT_SIZE = 16;
export const DEFAULT_FIELD_LABEL_FONT_SIZE = 14;
export const DEFAULT_FIELD_WIDTH = 100;
export const DEFAULT_INPUT_RADIUS = 8;
export const DEFAULT_INPUT_BORDER_WIDTH = 0;
export const DEFAULT_INPUT_BACKGROUND_COLOR: [string, string] = ["#FFFFFFFF", "#1C1C1EFF"];
export const DEFAULT_INPUT_BORDER_COLOR: [string, string] = ["#C7C7CCFF", "#48484AFF"];
