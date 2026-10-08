import { FLOAT_PATTERN, INTEGER_PATTERN, type MessageInputAttributeType } from "com.batch.dom/render/model/attribute-kinds";
import { type MessageInputType, MessageInputTypeValue } from "com.batch.dom/render/model/types";
import {
  RENDER_TEXT_KEY_FORM_INVALID_DATE_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_NUMBER_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_URL_ERROR,
} from "com.batch.dom/render/render-constants";
import { Consts } from "com.batch.shared/constants/user";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

/** Behavior profile per `inputType`. It mirrors the iOS and Android contracts, so `nativeRegex` stays ES5-safe and portable. */
export interface MessageInputDescriptor {
  /** `type` attribute of the rendered `<input>`. */
  htmlType: string;
  enterKeyHint: string;
  inputMode?: string;
  autocomplete?: string;
  autocapitalize?: string;
  autocorrect?: "on" | "off";
  spellcheck?: boolean;
  /** Native format rule of the type. It always applies, even with a custom payload regex. */
  nativeRegex?: string;
  /** Native maximum length of the type. A payload maximum can only lower it. */
  nativeMaxLength: number;
  /** Reserved `texts` key for the type-specific "invalid" error message. */
  invalidTextKey?: string;
}

const DESCRIPTORS: Record<MessageInputType, MessageInputDescriptor> = {
  [MessageInputTypeValue.Text]: {
    htmlType: "text",
    enterKeyHint: "next",
    nativeMaxLength: Consts.AttributeStringMaxLengthCEP,
  },
  [MessageInputTypeValue.Email]: {
    htmlType: "email",
    inputMode: "email",
    autocomplete: "email",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: false,
    enterKeyHint: "next",
    nativeRegex: Consts.EmailAddressRegexp.source,
    nativeMaxLength: Consts.EmailAddressMaxLength,
    invalidTextKey: RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  },
  [MessageInputTypeValue.Phone]: {
    htmlType: "tel",
    inputMode: "tel",
    autocomplete: "tel",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: false,
    enterKeyHint: "next",
    nativeRegex: Consts.PhoneNumberRegexp.source,
    nativeMaxLength: Consts.AttributeStringMaxLengthCEP,
    invalidTextKey: RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
  },
};

/** What `<input type="date">` produces; a choice option may carry a full ISO instant, which the kind still accepts. */
const DATE_INPUT_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

/** What collecting a declared type needs on top of the `fieldType` control. A URL carries no pattern: only `new URL` says what parses. */
const ATTRIBUTE_TYPE_DESCRIPTORS: Partial<Record<MessageInputAttributeType, Partial<MessageInputDescriptor>>> = {
  [ProfileAttributeType.INTEGER]: {
    inputMode: "numeric",
    nativeRegex: INTEGER_PATTERN,
    invalidTextKey: RENDER_TEXT_KEY_FORM_INVALID_NUMBER_ERROR,
  },
  [ProfileAttributeType.FLOAT]: {
    inputMode: "decimal",
    nativeRegex: FLOAT_PATTERN,
    invalidTextKey: RENDER_TEXT_KEY_FORM_INVALID_NUMBER_ERROR,
  },
  [ProfileAttributeType.DATE]: {
    htmlType: "date",
    nativeRegex: DATE_INPUT_PATTERN,
    invalidTextKey: RENDER_TEXT_KEY_FORM_INVALID_DATE_ERROR,
  },
  [ProfileAttributeType.URL]: {
    htmlType: "url",
    inputMode: "url",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: false,
    nativeMaxLength: Consts.AttributeURLMaxLength,
    invalidTextKey: RENDER_TEXT_KEY_FORM_INVALID_URL_ERROR,
  },
};

/** The `fieldType` descriptor, with the declared attribute type's own rules layered over it. */
export function getInputDescriptor(type: MessageInputType, attributeType: MessageInputAttributeType): MessageInputDescriptor {
  const overlay = ATTRIBUTE_TYPE_DESCRIPTORS[attributeType];
  return overlay === undefined ? DESCRIPTORS[type] : { ...DESCRIPTORS[type], ...overlay };
}
