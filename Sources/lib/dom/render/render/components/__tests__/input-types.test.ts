/* eslint-env jest */

import { type MessageInputType, MessageInputTypeValue } from "com.batch.dom/render/model/types";
import { getInputDescriptor, type MessageInputDescriptor } from "com.batch.dom/render/render/components/input-types";
import { Consts } from "com.batch.shared/constants/user";

const EXPECTED: Record<MessageInputType, MessageInputDescriptor> = {
  text: {
    htmlType: "text",
    enterKeyHint: "next",
    nativeMaxLength: Consts.AttributeStringMaxLengthCEP,
  },
  email: {
    htmlType: "email",
    inputMode: "email",
    autocomplete: "email",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: false,
    enterKeyHint: "next",
    nativeRegex: Consts.EmailAddressRegexp.source,
    nativeMaxLength: Consts.EmailAddressMaxLength,
    invalidTextKey: "batch.form.error.invalid.email",
  },
  phone: {
    htmlType: "tel",
    inputMode: "tel",
    autocomplete: "tel",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: false,
    enterKeyHint: "next",
    nativeRegex: Consts.PhoneNumberRegexp.source,
    nativeMaxLength: Consts.AttributeStringMaxLengthCEP,
    invalidTextKey: "batch.form.error.invalid.phone",
  },
};

const TYPES = Object.values(MessageInputTypeValue);

interface FormatCase {
  type: MessageInputType;
  accepted: string[];
  rejected: string[];
}

const FORMAT_CASES: FormatCase[] = [
  {
    type: "email",
    accepted: ["user@example.com", "a.b+c@sub.domain.co.uk", "user@example-domain.fr"],
    rejected: ["not-an-email", "userexample.com", "user@example", "@example.com", "user@@example.com"],
  },
  {
    type: "phone",
    accepted: ["+33612345678", "+1650253000", "+336"],
    rejected: ["0612345678", "+33 6 12 34 56 78", "(01) 23-45-67", "12345", "+", "+33 abc 45 67", "+33_612345678", "+3361234567890123"],
  },
];

describe("input type descriptors", () => {
  test.each(TYPES)("%s declares exactly its documented semantics", type => {
    expect(getInputDescriptor(type)).toStrictEqual(EXPECTED[type]);
  });

  test.each(TYPES)("%s declares the two attributes the renderer applies unconditionally", type => {
    const descriptor = getInputDescriptor(type);
    expect(descriptor.htmlType.length).toBeGreaterThan(0);
    expect(descriptor.enterKeyHint.length).toBeGreaterThan(0);
  });

  test("text carries no native format rule, so a plain text field can never fail on shape", () => {
    const descriptor = getInputDescriptor("text");
    expect(descriptor.nativeRegex).toBeUndefined();
    expect(descriptor.invalidTextKey).toBeUndefined();
  });

  test("the email native format is the SDK's own profile validator", () => {
    expect(getInputDescriptor("email").nativeRegex).toBe(Consts.EmailAddressRegexp.source);
  });

  test("the email native maximum length is the SDK's own profile bound", () => {
    expect(getInputDescriptor("email").nativeMaxLength).toBe(Consts.EmailAddressMaxLength);
  });

  test("the phone native format is the SDK's own profile validator", () => {
    expect(getInputDescriptor("phone").nativeRegex).toBe(Consts.PhoneNumberRegexp.source);
  });

  test.each(FORMAT_CASES)("$type native format is a compilable, anchored pattern", ({ type }) => {
    const source = getInputDescriptor(type).nativeRegex as string;
    expect(() => new RegExp(source)).not.toThrow();
    expect(source.startsWith("^")).toBe(true);
    expect(source.endsWith("$")).toBe(true);
  });

  test.each(FORMAT_CASES)("$type native format accepts its canonical shapes", ({ type, accepted }) => {
    const regex = new RegExp(getInputDescriptor(type).nativeRegex as string);
    for (const value of accepted) {
      expect(regex.test(value)).toBe(true);
    }
  });

  test.each(FORMAT_CASES)("$type native format rejects malformed values", ({ type, rejected }) => {
    const regex = new RegExp(getInputDescriptor(type).nativeRegex as string);
    for (const value of rejected) {
      expect(regex.test(value)).toBe(false);
    }
  });

  test.each(FORMAT_CASES)("$type native format stays portable enough to mirror natively", ({ type }) => {
    const source = getInputDescriptor(type).nativeRegex as string;
    expect(source).not.toMatch(/\(\?</);
  });

  test.each(FORMAT_CASES)("$type canonical shapes fit under its native maximum length", ({ type, accepted }) => {
    const { nativeMaxLength } = getInputDescriptor(type);
    for (const value of accepted) {
      expect(value.length).toBeLessThanOrEqual(nativeMaxLength);
    }
  });
});
