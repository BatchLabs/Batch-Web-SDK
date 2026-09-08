import { type MessageInputType, MessageInputTypeValue } from "com.batch.dom/render/model/types";
import { RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR, RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR } from "com.batch.dom/render/render-constants";
import { Consts } from "com.batch.shared/constants/user";

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

export function getInputDescriptor(type: MessageInputType): MessageInputDescriptor {
  return DESCRIPTORS[type];
}
