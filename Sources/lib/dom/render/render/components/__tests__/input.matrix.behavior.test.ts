/* eslint-env jest */

import type { MessageInputModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { DEFAULT_INPUT_TYPE } from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageInputPayload } from "com.batch.dom/render/model/types";
import { buildFieldMessage, FIELD_ID } from "com.batch.dom/render/test-utils/factories/field-payloads";
import type { AssertNever, ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { attributesOf, runComponentMatrix, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import type { styleProps } from "./input.matrix.style.test";

const control = (el: HTMLElement): HTMLInputElement => el.querySelector(".iam-input") as HTMLInputElement;
const BASE_CONTROL_ATTRS = { name: FIELD_ID, placeholder: "you@example.com", "aria-label": "Email" };
const label = (el: HTMLElement): HTMLLabelElement | null => el.querySelector<HTMLLabelElement>(".iam-field-label");
const HIDDEN_LABEL_CLASS = "iam-field-label--hidden";
const requiredMarker = (el: HTMLElement): HTMLElement | null => el.querySelector<HTMLElement>(".iam-field-label-required");

type BehaviorProps = Pick<
  MessageInputPayload,
  | "fieldType"
  | "attributeType"
  | "placeholderId"
  | "labelTextId"
  | "labelVisible"
  | "minMax"
  | "required"
  | "validation"
  | "hideOn"
  | "mapsTo"
>;

export const behaviorProps: PropMatrix<BehaviorProps, MessageInputModel> = {
  fieldType: {
    cases: [
      {
        name: "text → input type text, the text native cap and no assisted-entry attribute at all",
        patch: { fieldType: "text" },
        expectModel: m => expect(m.configuration.inputType).toBe("text"),
        expectCss: el =>
          expect(attributesOf(control(el))).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "text",
            enterkeyhint: "next",
            maxlength: String(Consts.AttributeStringMaxLengthCEP),
          }),
      },
      {
        name: "email → input type email, the email native cap and the email assisted-entry set",
        patch: { fieldType: "email" },
        expectModel: m => expect(m.configuration.inputType).toBe("email"),
        expectCss: el => {
          const c = control(el);
          expect(attributesOf(c)).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "email",
            inputmode: "email",
            autocomplete: "email",
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            enterkeyhint: "next",
            maxlength: String(Consts.EmailAddressMaxLength),
          });
        },
      },
      {
        name: "phone → input type tel, the generic native cap and the phone assisted-entry set",
        patch: { fieldType: "phone" },
        expectModel: m => expect(m.configuration.inputType).toBe("phone"),
        expectCss: el => {
          expect(attributesOf(control(el))).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "tel",
            inputmode: "tel",
            autocomplete: "tel",
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            enterkeyhint: "next",
            maxlength: String(Consts.AttributeStringMaxLengthCEP),
          });
        },
      },
      {
        name: "omitted → DEFAULT_INPUT_TYPE, rendered as the text descriptor and its native cap",
        patch: {},
        expectModel: m => expect(m.configuration.inputType).toBe(DEFAULT_INPUT_TYPE),
        expectCss: el =>
          expect(attributesOf(control(el))).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "text",
            enterkeyhint: "next",
            maxlength: String(Consts.AttributeStringMaxLengthCEP),
          }),
      },
      {
        name: "invalid → DEFAULT_INPUT_TYPE",
        patch: { fieldType: "weird" },
        expectModel: m => expect(m.configuration.inputType).toBe(DEFAULT_INPUT_TYPE),
        expectCss: el => expect(control(el).type).toBe("text"),
      },
    ],
  },

  attributeType: {
    cases: [
      {
        name: "omitted → string, the plain text control a field has always rendered",
        patch: {},
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.STRING),
        expectCss: el => expect([control(el).type, control(el).hasAttribute("inputmode")]).toEqual(["text", false]),
      },
      {
        name: "unknown → string, like any unreadable enum",
        patch: { attributeType: "money" },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.STRING),
        expectCss: el => expect(control(el).type).toBe("text"),
      },
      {
        name: "integer → the text control, with the digit keyboard and no other assisted-entry attribute",
        patch: { attributeType: "integer" },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.INTEGER),
        expectCss: el =>
          expect(attributesOf(control(el))).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "text",
            inputmode: "numeric",
            enterkeyhint: "next",
            maxlength: String(Consts.AttributeStringMaxLengthCEP),
          }),
      },
      {
        name: "float → the text control, with the decimal keyboard and no other assisted-entry attribute",
        patch: { attributeType: "float" },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.FLOAT),
        expectCss: el =>
          expect(attributesOf(control(el))).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "text",
            inputmode: "decimal",
            enterkeyhint: "next",
            maxlength: String(Consts.AttributeStringMaxLengthCEP),
          }),
      },
      {
        name: "date → the native date control, which constrains the entry instead of widening it with a keyboard hint",
        patch: { attributeType: "date" },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.DATE),
        expectCss: el =>
          expect(attributesOf(control(el))).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "date",
            enterkeyhint: "next",
            maxlength: String(Consts.AttributeStringMaxLengthCEP),
          }),
      },
      {
        name: "url → the native url control, its own native cap and the url assisted-entry set",
        patch: { attributeType: "url" },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.URL),
        expectCss: el =>
          expect(attributesOf(control(el))).toEqual({
            ...BASE_CONTROL_ATTRS,
            type: "url",
            inputmode: "url",
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            enterkeyhint: "next",
            maxlength: String(Consts.AttributeURLMaxLength),
          }),
      },
    ],
  },

  placeholderId: {
    cases: [
      {
        name: "resolves the placeholder text",
        patch: { placeholderId: "email_ph" },
        message: { texts: { email: "Email", email_ph: "you@example.com" } },
        expectModel: m => expect(m.configuration.placeholderId).toBe("email_ph"),
        expectCss: el => expect(control(el).placeholder).toBe("you@example.com"),
      },
      {
        name: "null → no placeholder",
        patch: { placeholderId: null },
        expectModel: m => expect(m.configuration.placeholderId).toBeUndefined(),
        expectCss: el => expect(control(el).placeholder).toBe(""),
      },
      {
        name: "omitted → no placeholder",
        patch: { placeholderId: undefined },
        expectModel: m => expect(m.configuration.placeholderId).toBeUndefined(),
        expectCss: el => expect(control(el).placeholder).toBe(""),
      },
    ],
  },

  labelTextId: {
    cases: [
      {
        name: "resolved → label text rendered, control named after the field id",
        patch: {},
        message: { texts: { email_label: "Your email", email_ph: "you@example.com" } },
        expectModel: m => expect(m.configuration.labelTextId).toBe("email_label"),
        expectCss: el => {
          expect(label(el)?.textContent).toBe("Your email");
          expect(control(el).name).toBe(FIELD_ID);
          expect(label(el)?.getAttribute("aria-label")).toBe("Your email");
          expect(control(el).getAttribute("aria-label")).toBe("Your email");
        },
      },
      {
        name: "texts has no entry for the id → no label, aria-label falls back to the placeholder",
        patch: {},
        message: { texts: { email_ph: "you@example.com" } },
        expectCss: el => {
          expect(label(el)).toBeNull();
          expect(control(el).getAttribute("aria-label")).toBe("you@example.com");
        },
      },
      {
        name: "omitted → no label",
        patch: { labelTextId: undefined },
        message: { texts: { email: "Email", email_label: "Email address", email_ph: "you@example.com" } },
        expectModel: m => expect(m.configuration.labelTextId).toBeUndefined(),
        expectCss: el => expect(label(el)).toBeNull(),
      },
      {
        name: "null → no label",
        patch: { labelTextId: null },
        expectModel: m => expect(m.configuration.labelTextId).toBeUndefined(),
        expectCss: el => expect(label(el)).toBeNull(),
      },
      {
        name: "empty string → no label",
        patch: { labelTextId: "" },
        expectModel: m => expect(m.configuration.labelTextId).toBeUndefined(),
        expectCss: el => expect(label(el)).toBeNull(),
      },
    ],
  },

  labelVisible: {
    cases: [
      {
        name: "false → label kept in the DOM but visually hidden, for/id link preserved",
        patch: { labelVisible: false },
        expectModel: m => expect(m.configuration.labelVisible).toBe(false),
        expectCss: el => {
          const labelEl = label(el);
          expect(labelEl).not.toBeNull();
          expect(labelEl?.classList.contains(HIDDEN_LABEL_CLASS)).toBe(true);
          expect(labelEl?.textContent).toBe("Email");
          expect(labelEl?.htmlFor).toBe(control(el).id);
          expect(labelEl?.getAttribute("aria-label")).toBeNull();
          expect(control(el).getAttribute("aria-label")).toBe("you@example.com");
        },
      },
      {
        name: "true → visible label",
        patch: { labelVisible: true },
        expectModel: m => expect(m.configuration.labelVisible).toBe(true),
        expectCss: el => expect(label(el)?.classList.contains(HIDDEN_LABEL_CLASS)).toBe(false),
      },
      {
        name: "omitted → visible label",
        patch: {},
        expectModel: m => expect(m.configuration.labelVisible).toBe(true),
        expectCss: el => expect(label(el)?.classList.contains(HIDDEN_LABEL_CLASS)).toBe(false),
      },
      {
        name: "malformed 'false' string → visible label (only a strict false hides it)",
        patch: { labelVisible: "false" },
        expectModel: m => expect(m.configuration.labelVisible).toBe(true),
        expectCss: el => expect(label(el)?.classList.contains(HIDDEN_LABEL_CLASS)).toBe(false),
      },
      {
        name: "false without a resolved label → no label, aria-label cascade kept",
        patch: { labelVisible: false, labelTextId: undefined },
        expectModel: m => {
          expect(m.configuration.labelVisible).toBe(false);
          expect(m.configuration.labelTextId).toBeUndefined();
        },
        expectCss: el => {
          expect(label(el)).toBeNull();
          expect(control(el).getAttribute("aria-label")).toBe("you@example.com");
        },
      },
    ],
  },

  minMax: {
    cases: [
      {
        name: "explicit, below the native cap → minLength model and the payload maxlength",
        patch: { minMax: [2, 12] },
        expectModel: m => {
          expect(m.configuration.minLength).toBe(2);
          expect(m.configuration.maxLength).toBe(12);
        },
        expectCss: el => expect(control(el).maxLength).toBe(12),
      },
      {
        name: "min equal to max → exact length kept",
        patch: { minMax: [6, 6] },
        expectModel: m => {
          expect(m.configuration.minLength).toBe(6);
          expect(m.configuration.maxLength).toBe(6);
        },
        expectCss: el => expect(control(el).maxLength).toBe(6),
      },
      {
        name: "fractional → floored",
        patch: { minMax: [2.9, 12.9] },
        expectModel: m => {
          expect(m.configuration.minLength).toBe(2);
          expect(m.configuration.maxLength).toBe(12);
        },
        expectCss: el => expect(control(el).maxLength).toBe(12),
      },
      {
        name: "explicit, above the native cap → native cap kept",
        patch: { minMax: [2, 5000] },
        expectModel: m => {
          expect(m.configuration.minLength).toBe(2);
          expect(m.configuration.maxLength).toBe(5000);
        },
        expectCss: el => expect(control(el).maxLength).toBe(Consts.AttributeStringMaxLengthCEP),
      },
      {
        name: "[0, 0] → no payload constraint, native cap applies",
        patch: { minMax: [0, 0] },
        expectModel: m => {
          expect(m.configuration.minLength).toBeUndefined();
          expect(m.configuration.maxLength).toBeUndefined();
        },
        expectCss: el => expect(control(el).maxLength).toBe(Consts.AttributeStringMaxLengthCEP),
      },
      {
        name: "min > max → payload pair dropped entirely, native cap applies",
        patch: { minMax: [50, 25] },
        expectModel: m => {
          expect(m.configuration.minLength).toBeUndefined();
          expect(m.configuration.maxLength).toBeUndefined();
        },
        expectCss: el => expect(control(el).maxLength).toBe(Consts.AttributeStringMaxLengthCEP),
      },
      {
        name: "negative entry → payload pair dropped entirely, native cap applies",
        patch: { minMax: [-1, 25] },
        expectModel: m => {
          expect(m.configuration.minLength).toBeUndefined();
          expect(m.configuration.maxLength).toBeUndefined();
        },
        expectCss: el => expect(control(el).maxLength).toBe(Consts.AttributeStringMaxLengthCEP),
      },
      {
        name: "omitted → no payload maximum, native cap still stamped",
        patch: {},
        expectModel: m => {
          expect(m.configuration.minLength).toBeUndefined();
          expect(m.configuration.maxLength).toBeUndefined();
        },
        expectCss: el => {
          expect(control(el).hasAttribute("maxlength")).toBe(true);
          expect(control(el).maxLength).toBe(Consts.AttributeStringMaxLengthCEP);
        },
      },
      {
        name: "on a typed field → ignored, only the native bound of its kind applies",
        patch: { attributeType: "url", minMax: [5, 10] },
        expectModel: m => {
          expect(m.configuration.minLength).toBeUndefined();
          expect(m.configuration.maxLength).toBeUndefined();
        },
        expectCss: el => expect(control(el).maxLength).toBe(Consts.AttributeURLMaxLength),
      },
    ],
  },

  required: {
    cases: [
      {
        name: "true → aria-required and label marker",
        patch: { required: true },
        expectModel: m => expect(m.required).toBe(true),
        expectCss: el => {
          expect(control(el).getAttribute("aria-required")).toBe("true");
          expect(requiredMarker(el)?.textContent).toBe("*");
        },
      },
      {
        name: "omitted → false, no aria-required, no marker",
        patch: {},
        expectModel: m => expect(m.required).toBe(false),
        expectCss: el => {
          expect(control(el).getAttribute("aria-required")).toBeNull();
          expect(requiredMarker(el)).toBeNull();
        },
      },
      {
        name: "non-boolean → false, no aria-required, no marker",
        patch: { required: "true" },
        expectModel: m => expect(m.required).toBe(false),
        expectCss: el => {
          expect(control(el).getAttribute("aria-required")).toBeNull();
          expect(requiredMarker(el)).toBeNull();
        },
      },
    ],
  },

  validation: {
    cssExpression: "none",
    cases: [
      {
        name: "regex compilable → kept",
        patch: { validation: { regex: "^[0-9]{4}$" } },
        expectModel: m => expect(m.validation).toEqual({ regex: "^[0-9]{4}$" }),
      },
      {
        name: "regex invalid → dropped (field kept)",
        patch: { validation: { regex: "([" } },
        expectModel: m => expect(m.validation).toBeUndefined(),
      },
      {
        name: "errorId → kept",
        patch: { validation: { errorId: "email_err" } },
        expectModel: m => expect(m.validation).toEqual({ errorId: "email_err" }),
      },
      {
        name: "regex + errorId → both kept",
        patch: { validation: { regex: "^.+$", errorId: "email_err" } },
        expectModel: m => expect(m.validation).toEqual({ regex: "^.+$", errorId: "email_err" }),
      },
      {
        name: "omitted → undefined",
        patch: {},
        expectModel: m => expect(m.validation).toBeUndefined(),
      },
    ],
  },

  hideOn: {
    cases: [
      {
        name: "stray value dropped from the model and never stamped as a class",
        patch: { hideOn: "mobile" },
        expectModel: m => expect("hideOn" in m).toBe(false),
        expectCss: el => expect(el.className).not.toContain("iam-hide"),
      },
    ],
  },

  mapsTo: {
    cssExpression: "none",
    cases: [
      {
        name: "explicit value kept verbatim",
        patch: { mapsTo: "custom_target" },
        expectModel: m => expect(m.mapsTo).toBe("custom_target"),
      },
      {
        name: "surrounding whitespace trimmed",
        patch: { mapsTo: "  spaced_target  " },
        expectModel: m => expect(m.mapsTo).toBe("spaced_target"),
      },
      {
        name: "an email-looking prefix carries no meaning, it stays opaque",
        patch: { mapsTo: "email_marketing_consent" },
        expectModel: m => expect(m.mapsTo).toBe("email_marketing_consent"),
      },
    ],
  },
};

type UncoveredInputProp = Exclude<keyof Omit<MessageInputPayload, "type" | "id">, keyof typeof styleProps | keyof typeof behaviorProps>;
export type EveryInputPropIsCovered = AssertNever<UncoveredInputProp>;

const spec: ComponentMatrixSpec<BehaviorProps, MessageInputModel> = {
  label: "Field behavior",
  buildPayload: buildFieldMessage,
  select: message => selectFirstChild<MessageInputModel>(message, "field"),
  props: behaviorProps,
};

runComponentMatrix(spec);

describe("Field behavior · mapsTo rejection", () => {
  const warn = jest.spyOn(Log, "warn");

  beforeEach(() => warn.mockImplementation(() => undefined));
  afterEach(() => warn.mockReset());

  test.each([
    ["missing", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
    ["non-string", 42],
  ])("%s drops the field and warns", (_label, mapsTo) => {
    const message = normalizeMessage(buildFieldMessage({ mapsTo }));

    expect(message.root.children.some(child => child.type === "field")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(FIELD_ID));
  });

  test("the submit button survives the dropped field", () => {
    const message = normalizeMessage(buildFieldMessage({ mapsTo: "" }));

    expect(message.root.children).toHaveLength(1);
    expect(message.root.children[0]?.type).toBe("button");
  });
});

describe("Field behavior · attributeType rejection", () => {
  const warn = jest.spyOn(Log, "warn");

  beforeEach(() => warn.mockImplementation(() => undefined));
  afterEach(() => warn.mockReset());

  test.each<[string, Record<string, unknown>]>([
    ["a boolean, which no text control can carry", { attributeType: "boolean" }],
    ["an array, which belongs to a checkbox group", { attributeType: "array" }],
    ["an integer on an email field", { fieldType: "email", attributeType: "integer" }],
    ["a date on a phone field", { fieldType: "phone", attributeType: "date" }],
    ["a url on a native slot, which holds a string", { mapsTo: "$email_address", attributeType: "url" }],
  ])("%s drops the field and warns", (_label, patch) => {
    const message = normalizeMessage(buildFieldMessage(patch));

    expect(message.root.children.some(child => child.type === "field")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(FIELD_ID));
  });
});
