/* eslint-env jest */

import { landingDefaultTexts } from "com.batch.dom/render/landing-page/landing-page-l10n";
import type { MessageInputModel, MessageModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageInputPayload } from "com.batch.dom/render/model/types";
import { renderInput } from "com.batch.dom/render/render/components/input";
import type { FormRenderContext } from "com.batch.dom/render/render/form-setup";
import { MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import { ATTRIBUTE_TYPE_CASES, TEXT_FIELD_ATTRIBUTE_TYPES } from "com.batch.dom/render/test-utils/factories/attribute-type-cases";
import { componentMessage, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

const SUBMIT_ID = "f:submit";

const BASE_TEXTS = { email: "Email", email_ph: "you@example.com", email_err: "Email invalide" };

const noopRuntime = {
  setSubmitting: jest.fn(),
  showFormMessage: jest.fn(),
  clearFormMessage: jest.fn(),
  complete: jest.fn(),
};

function context(message: MessageModel, domScope = "t"): FormRenderContext {
  return {
    form: new MessageFormController(
      message,
      SUBMIT_ID,
      noopRuntime,
      jest.fn(() => Promise.resolve({ kind: "none" as const }))
    ),
    domScope,
    submitId: SUBMIT_ID,
    submitButtonEl: null,
  };
}

interface FieldOptions {
  texts?: Record<string, string>;
  domScope?: string;
}

interface FieldSetup {
  model: MessageInputModel;
  message: MessageModel;
  ctx: FormRenderContext;
}

function fieldSetup(patch: Partial<MessageInputPayload> = {}, options: FieldOptions = {}): FieldSetup {
  const message = normalizeMessage(
    componentMessage(
      {
        type: "field",
        id: "email",
        mapsTo: "email_map",
        placeholderId: "email_ph",
        labelTextId: "email",
        labelColor: ["#333333FF"],
        padding: [8, 8, 8, 8],
        ...patch,
      },
      { texts: options.texts ?? { ...BASE_TEXTS }, actions: { [SUBMIT_ID]: { action: "batch.form.submit" } } }
    )
  );
  return {
    model: selectFirstChild<MessageInputModel>(message, "field"),
    message,
    ctx: context(message, options.domScope),
  };
}

interface FieldRender extends FieldSetup {
  el: HTMLElement;
  control: HTMLInputElement;
  label: HTMLLabelElement | null;
}

function renderField(patch: Partial<MessageInputPayload> = {}, options: FieldOptions = {}): FieldRender {
  const setup = fieldSetup(patch, options);
  const el = renderInput(setup.model, setup.message, setup.ctx);
  return {
    ...setup,
    el,
    control: el.querySelector("input") as HTMLInputElement,
    label: el.querySelector(".iam-field-label"),
  };
}

describe("form field components", () => {
  test("labelVisible false renders the label visually hidden, keeping the for/id link and carrying no aria-label", () => {
    const { label, control } = renderField({ labelVisible: false });
    expect(label).not.toBeNull();
    expect(label?.classList.contains("iam-field-label--hidden")).toBe(true);
    expect(label?.textContent).toBe("Email");
    expect(label?.htmlFor).toBe(control.id);
    expect(label?.getAttribute("aria-label")).toBeNull();
    expect(control.getAttribute("aria-label")).toBe("you@example.com");
  });

  test("a visible label carries no hidden modifier", () => {
    expect(renderField().label?.classList.contains("iam-field-label--hidden")).toBe(false);
  });

  test("a required field appends a marker to its visible label, hidden from screen readers", () => {
    const { label, control } = renderField({ required: true });
    const marker = label?.querySelector(".iam-field-label-required");

    expect(marker?.textContent).toBe("*");
    expect(marker?.getAttribute("aria-hidden")).toBe("true");
    expect(label?.firstChild?.textContent).toBe("Email");
    expect(label?.getAttribute("aria-label")).toBe("Email");
    expect(control.getAttribute("aria-label")).toBe("Email");
    expect(label?.htmlFor).toBe(control.id);
    expect(control.placeholder).toBe("you@example.com");
  });

  test("an optional field renders no required marker", () => {
    expect(renderField().label?.querySelector(".iam-field-label-required")).toBeNull();
  });

  test("a required field with a hidden label stars its placeholder instead of the label", () => {
    const { label, control } = renderField({ required: true, labelVisible: false });

    expect(label?.classList.contains("iam-field-label--hidden")).toBe(true);
    expect(label?.querySelector(".iam-field-label-required")).toBeNull();
    expect(control.placeholder).toBe("you@example.com *");
    expect(control.getAttribute("aria-label")).toBe("you@example.com");
    expect(control.getAttribute("aria-required")).toBe("true");
  });

  test("a required field without a resolved label stars its placeholder and keeps aria-required", () => {
    const { el, label, control } = renderField({ required: true, labelTextId: null });

    expect(label).toBeNull();
    expect(el.querySelector(".iam-field-label-required")).toBeNull();
    expect(control.placeholder).toBe("you@example.com *");
    expect(control.getAttribute("aria-label")).toBe("you@example.com");
    expect(control.getAttribute("aria-required")).toBe("true");
  });

  test("a required field without a label nor a placeholder shows the star alone and names itself after the field id", () => {
    const { control } = renderField({ required: true, labelTextId: null, placeholderId: null });

    expect(control.placeholder).toBe("*");
    expect(control.getAttribute("aria-label")).toBe("email");
  });

  test("labelVisible false without a resolved label keeps the aria-label cascade", () => {
    const { label, control } = renderField({ labelTextId: null, labelVisible: false });
    expect(label).toBeNull();
    expect(control.getAttribute("aria-label")).toBe("you@example.com");
  });

  test("a visible label and its control carry the same explicit accessible name", () => {
    const { label, control } = renderField();
    expect(label?.getAttribute("aria-label")).toBe("Email");
    expect(control.getAttribute("aria-label")).toBe("Email");
  });

  test("without a label the accessible name falls back to the placeholder text", () => {
    expect(renderField({ labelTextId: null }).control.getAttribute("aria-label")).toBe("you@example.com");
  });

  test("without a label nor a placeholder the accessible name falls back to the field id", () => {
    expect(renderField({ labelTextId: null, placeholderId: null }).control.getAttribute("aria-label")).toBe("email");
  });

  test("a value shorter than minLength blocks the submit; an empty optional value passes", () => {
    const { control, ctx } = renderField({ minMax: [4, 0] });

    control.value = "abc";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "abcd";
    expect(ctx.form?.validateAll()).toBe(true);

    control.value = "";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("generated DOM ids are namespaced by the render scope", () => {
    const { el, control, label } = renderField({ required: true }, { domScope: "abc123" });
    expect(control.id).toBe("email-abc123");
    expect(label?.htmlFor).toBe("email-abc123");
    expect((el.querySelector(".iam-field-error") as HTMLElement).id).toBe("email-abc123-error");
    expect(control.name).toBe("email");
  });

  test("email input validates format with its native pattern when no custom regex is provided", () => {
    const { control, ctx } = renderField({ fieldType: "email" });

    control.value = "not-an-email";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "user@example.com";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("phone native format applies even when the payload carries an errorId-only validation (demo shape)", () => {
    const { control, ctx } = renderField({ fieldType: "phone", required: true, validation: { errorId: "email_err" } });

    control.value = "0612345678";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "+33612345678";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("a custom regex narrows the native format instead of replacing it", () => {
    const { control, ctx } = renderField({ fieldType: "phone", required: true, validation: { regex: "^[0-9]{4}$" } });

    control.value = "1234";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "+33612345678";
    expect(ctx.form?.validateAll()).toBe(false);

    const both = renderField({ fieldType: "phone", required: true, validation: { regex: "^\\+336[0-9]{8}$" } });
    both.control.value = "+33612345678";
    expect(both.ctx.form?.validateAll()).toBe(true);
  });

  test("a permissive custom regex cannot bypass the native email format", () => {
    const { control, ctx } = renderField({ fieldType: "email", required: true, validation: { regex: ".*" } });

    control.value = "not-an-email";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "user@example.com";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("a field mapped to $email_address runs the profile email validator whatever its input type", () => {
    const { control, ctx } = renderField({ fieldType: "text", required: true, mapsTo: "$email_address" });

    expect(control.maxLength).toBe(Consts.EmailAddressMaxLength);

    control.value = "not-an-email";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "user@example.com";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("a field mapped to $phone_number runs the profile phone format whatever its input type", () => {
    const { control, ctx } = renderField({ fieldType: "text", required: true, mapsTo: "$phone_number" });

    control.value = "0612345678";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "+33612345678";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("an email field refuses a malformed address even when it writes a custom attribute", () => {
    const { el, control, ctx } = renderField(
      { fieldType: "email", mapsTo: "contact_email" },
      { texts: { ...BASE_TEXTS, "batch.form.error.invalid.email": "Adresse email invalide" } }
    );

    control.value = "not-an-email";
    expect(ctx.form?.validateAll()).toBe(false);
    expect((el.querySelector(".iam-field-error") as HTMLElement).textContent).toBe("Adresse email invalide");

    control.value = "someone@batch.com";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({ contact_email: { type: ProfileAttributeType.STRING, value: "someone@batch.com" } });
  });

  test("a phone field refuses a malformed number even when it writes a custom attribute", () => {
    const { el, control, ctx } = renderField(
      { fieldType: "phone", mapsTo: "contact_phone" },
      { texts: { ...BASE_TEXTS, "batch.form.error.invalid.phone": "Numéro invalide" } }
    );

    control.value = "0612345678";
    expect(ctx.form?.validateAll()).toBe(false);
    expect((el.querySelector(".iam-field-error") as HTMLElement).textContent).toBe("Numéro invalide");

    control.value = "+33612345678";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({ contact_phone: { type: ProfileAttributeType.STRING, value: "+33612345678" } });
  });
  test("an absent or oversized payload maxLength leaves the native cap in place", () => {
    expect(renderField({ fieldType: "text" }).control.maxLength).toBe(Consts.AttributeStringMaxLengthCEP);
    expect(renderField({ fieldType: "text", minMax: [0, Consts.AttributeStringMaxLengthCEP + 50] }).control.maxLength).toBe(
      Consts.AttributeStringMaxLengthCEP
    );
    expect(renderField({ fieldType: "email" }).control.maxLength).toBe(Consts.EmailAddressMaxLength);
  });

  test("a value over the effective maximum blocks the submit even when assigned programmatically", () => {
    const { control, ctx } = renderField({ fieldType: "text", minMax: [0, 5] });

    control.value = "abcdef";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "abcde";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("a payload minimum above the effective maximum is dropped instead of freezing the field", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const { model, control, ctx } = renderField({ fieldType: "email", minMax: [200, 300] });

    expect(model.configuration.minLength).toBe(200);
    expect(control.maxLength).toBe(Consts.EmailAddressMaxLength);
    expect(warn).toHaveBeenCalledWith(
      "Messaging",
      '[form] field "email": minimum length 200 exceeds the effective maximum 128, minimum ignored'
    );

    control.value = `${"a".repeat(60)}@example.com`;
    expect(ctx.form?.validateAll()).toBe(true);

    control.value = `${"a".repeat(130)}@example.com`;
    expect(ctx.form?.validateAll()).toBe(false);

    warn.mockRestore();
  });

  test("a payload minimum the effective maximum can satisfy keeps rejecting a too short value", () => {
    const { control, ctx } = renderField({ fieldType: "text", minMax: [2, 12] });

    control.value = "a";
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "ab";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("a minimum equal to the effective maximum is kept, one above it is dropped", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const exact = renderField({ fieldType: "text", minMax: [5, 5] });
    expect(exact.control.maxLength).toBe(5);

    // A minimum equal to the maximum is kept, so a shorter value is still refused.
    exact.control.value = "abcd";
    expect(exact.ctx.form?.validateAll()).toBe(false);

    exact.control.value = "abcde";
    expect(exact.ctx.form?.validateAll()).toBe(true);

    // Above the native cap the minimum is unsatisfiable, so it is dropped and the same short value passes.
    const above = renderField({ fieldType: "text", minMax: [400, 500] });
    expect(above.control.maxLength).toBe(Consts.AttributeStringMaxLengthCEP);

    above.control.value = "abcd";
    expect(above.ctx.form?.validateAll()).toBe(true);

    warn.mockRestore();
  });

  test("every rule judges the trimmed value the submit actually sends", () => {
    const max = renderField({ fieldType: "text", minMax: [0, 5] });
    max.control.value = "  abcde  ";
    expect(max.ctx.form?.validateAll()).toBe(true);

    const min = renderField({ fieldType: "text", minMax: [5, 0] });
    min.control.value = "  ab  ";
    expect(min.ctx.form?.validateAll()).toBe(false);

    const padded = renderField({ fieldType: "email", required: true, validation: { regex: "^[^@]+@[^@]+$" } });
    padded.control.value = "  user@example.com  ";
    expect(padded.ctx.form?.validateAll()).toBe(true);
    expect(padded.ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.STRING, value: "user@example.com" } });
  });

  test("a malformed payload regex is skipped so it never breaks validation or submit", () => {
    const { model, message, ctx } = fieldSetup({ required: true });
    model.validation = { regex: "([" };
    const control = renderInput(model, message, ctx).querySelector("input") as HTMLInputElement;

    control.value = "anything goes";
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("focusing an invalid field scrolls it into view when the environment supports it", () => {
    const { control, ctx } = renderField({ required: true });
    const scrollIntoView = jest.fn();
    (control as unknown as { scrollIntoView: unknown }).scrollIntoView = scrollIntoView;

    ctx.form?.validateAll();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  test("focusing an invalid field tolerates environments without scrollIntoView", () => {
    const { control, ctx } = renderField({ required: true });
    (control as unknown as { scrollIntoView?: unknown }).scrollIntoView = undefined;

    expect(() => ctx.form?.validateAll()).not.toThrow();
    expect(control.getAttribute("aria-invalid")).toBe("true");
  });

  test("required input exposes aria-required and gets aria-invalid + describedby after an error", () => {
    const { control, ctx } = renderField({ required: true });
    expect(control.getAttribute("aria-required")).toBe("true");

    ctx.form?.validateAll();
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe("email-t-error");
    expect(control.classList.contains("iam-input--error")).toBe(true);
  });

  test("an invalid field shows the error border and the message below the field", () => {
    const { el, ctx } = renderField({ required: true });

    ctx.form?.validateAll();
    const errorNode = el.querySelector(".iam-field-error") as HTMLElement;
    expect(errorNode.textContent?.length).toBeGreaterThan(0);
    expect(errorNode.classList.contains("iam-field-error--visible")).toBe(true);
  });

  test("the required error fallback is overridable through the reserved texts key", () => {
    const { el, ctx } = renderField({ required: true }, { texts: { ...BASE_TEXTS, "batch.form.error.required": "Champ obligatoire" } });
    ctx.form?.validateAll();
    expect((el.querySelector(".iam-field-error") as HTMLElement).textContent).toBe("Champ obligatoire");
  });

  test("the control fills its wrapper, the payload width applies to the wrapper only", () => {
    const { el, control } = renderField({ width: 50 });

    expect(control.style.width).toBe("100%");
    expect(el.style.width).toBe("50%");
  });
});

describe("typed form fields", () => {
  const errorText = (el: HTMLElement): string | null => (el.querySelector(".iam-field-error") as HTMLElement).textContent;
  // The copy the SDK ships, so a test reads the message a user would see.
  const EN_TEXTS = { ...landingDefaultTexts("en"), ...BASE_TEXTS };

  test("an integer field submits a typed integer", () => {
    const { control, ctx } = renderField({ attributeType: "integer" });

    control.value = "42";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.INTEGER, value: 42 } });
  });

  test("a typed field trims what the user padded, and still submits the typed value", () => {
    const typed = renderField({ attributeType: "integer" });
    typed.control.value = "  42  ";
    expect(typed.ctx.form?.validateAll()).toBe(true);
    expect(typed.ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.INTEGER, value: 42 } });

    // A string field keeps the raw text; the controller trims it on collect.
    const text = renderField({ attributeType: "string" });
    text.control.value = "  padded  ";
    expect(text.ctx.form?.validateAll()).toBe(true);
    expect(text.ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.STRING, value: "padded" } });
  });

  test("a float field keeps an integral entry a float, which no inference could tell", () => {
    const { control, ctx } = renderField({ attributeType: "float" });

    control.value = "2";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.FLOAT, value: 2 } });
  });

  test("a float field reads a lone comma as the decimal separator, never as a grouping one", () => {
    const { control, ctx } = renderField({ attributeType: "float" });

    control.value = "2,5";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.FLOAT, value: 2.5 } });

    control.value = "1.000,5";
    expect(ctx.form?.validateAll()).toBe(false);
  });

  test("a numeric field rejects an entry that is not a number", () => {
    const { el, control, ctx } = renderField({ attributeType: "integer" });

    control.value = "4a";
    expect(ctx.form?.validateAll()).toBe(false);
    expect(errorText(el)).toBe("This value is invalid.");
  });

  test("the numeric error is overridable through its reserved texts key", () => {
    const { el, control, ctx } = renderField(
      { attributeType: "integer" },
      { texts: { ...BASE_TEXTS, "batch.form.error.invalid.number": "Digits only" } }
    );

    control.value = "4a";
    expect(ctx.form?.validateAll()).toBe(false);
    expect(errorText(el)).toBe("Digits only");
  });

  test("an empty optional typed field submits nothing", () => {
    const { ctx } = renderField({ attributeType: "float" });

    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({});
  });

  test("a numeric field asks for the keyboard its digits need", () => {
    expect(renderField({ attributeType: "integer" }).control.getAttribute("inputmode")).toBe("numeric");
    expect(renderField({ attributeType: "float" }).control.getAttribute("inputmode")).toBe("decimal");
  });

  test("a date field renders the native date control and submits the instant it names", () => {
    const { control, ctx } = renderField({ attributeType: "date" });

    expect(control.type).toBe("date");
    control.value = "2026-09-09";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.DATE, value: new Date("2026-09-09") } });
  });

  test("a url field renders the native url control and holds a full profile URL", () => {
    const { control, ctx } = renderField({ attributeType: "url" });

    expect(control.type).toBe("url");
    expect(control.maxLength).toBe(Consts.AttributeURLMaxLength);
    control.value = "https://batch.com/pricing";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({
      email_map: { type: ProfileAttributeType.URL, value: new URL("https://batch.com/pricing") },
    });
  });

  test("a url field rejects what no URL parser accepts, which no regex could decide", () => {
    const { el, control, ctx } = renderField(
      { attributeType: "url" },
      { texts: { ...BASE_TEXTS, "batch.form.error.invalid.url": "URL invalide" } }
    );

    control.value = "not a url";
    expect(ctx.form?.validateAll()).toBe(false);
    expect(errorText(el)).toBe("URL invalide");
  });

  test.each(TEXT_FIELD_ATTRIBUTE_TYPES)("a %s field submits the typed value its kind yields", type => {
    const { control, ctx } = renderField({ attributeType: type });
    const sample = ATTRIBUTE_TYPE_CASES[type].accepted[0];

    control.value = sample.text;
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes().email_map).toEqual(sample.value);
  });

  // Excluded: an empty string is a blank optional field, and the native date control drops refused text (tested below).
  test.each(TEXT_FIELD_ATTRIBUTE_TYPES.filter(type => type !== "string" && type !== "date"))(
    "a %s field holding what its kind refuses blocks the submit and carries nothing",
    type => {
      const { control, ctx } = renderField({ attributeType: type });

      control.value = ATTRIBUTE_TYPE_CASES[type].refused[0];
      expect(ctx.form?.validateAll()).toBe(false);
      expect(ctx.form?.collectAttributes()).toEqual({});
    }
  );

  // The native maxLength counts characters: 200 accented letters fit it, but weigh 400 bytes, past what the server takes.
  test("a string field holding more bytes than the profile stores blocks the submit", () => {
    const { control, ctx } = renderField({ attributeType: "string" });

    control.value = "é".repeat(200);
    expect(ctx.form?.validateAll()).toBe(false);

    control.value = "é".repeat(150);
    expect(ctx.form?.validateAll()).toBe(true);
  });

  test("a date field holds only what its native control yields, and refuses the shorthand the parser would take", () => {
    const { el, control, ctx } = renderField({ attributeType: "date" }, { texts: EN_TEXTS });

    // The native control drops anything that is not a full date, so an optional field is simply left empty.
    control.value = "2026-9-9";
    expect(control.value).toBe("");
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({});

    // Where `type="date"` degrades to a free text control, the pattern is the only guard: `Date.parse` takes that shorthand.
    Object.defineProperty(control, "value", { value: "2026-9-9", configurable: true });
    expect(ctx.form?.validateAll()).toBe(false);
    expect(errorText(el)).toBe("Please enter a valid date.");
  });

  test("an integer past the pattern bound is refused by the pattern, before the kind", () => {
    const { el, control, ctx } = renderField({ attributeType: "integer" }, { texts: EN_TEXTS });

    control.value = "1234567890123456";
    expect(ctx.form?.validateAll()).toBe(false);
    expect(errorText(el)).toBe("Please enter a valid number.");

    control.value = "999999999999999";
    expect(ctx.form?.validateAll()).toBe(true);
    expect(ctx.form?.collectAttributes()).toEqual({ email_map: { type: ProfileAttributeType.INTEGER, value: 999999999999999 } });
  });

  test("blur validates a touched field, and leaves an untouched one alone", () => {
    const touched = renderField({ attributeType: "integer" }, { texts: EN_TEXTS });
    touched.control.value = "4a";
    touched.control.dispatchEvent(new Event("input"));
    touched.control.dispatchEvent(new Event("blur"));

    expect(touched.control.getAttribute("aria-invalid")).toBe("true");
    expect(errorText(touched.el)).toBe("Please enter a valid number.");

    const untouched = renderField({ attributeType: "integer" }, { texts: EN_TEXTS });
    untouched.control.value = "4a";
    untouched.control.dispatchEvent(new Event("blur"));

    expect(untouched.control.getAttribute("aria-invalid")).toBeNull();
    expect((untouched.el.querySelector(".iam-field-error") as HTMLElement).classList.contains("iam-field-error--visible")).toBe(false);
  });

  test("only Enter reaches the submit button", () => {
    const { control, ctx } = renderField();
    const button = document.createElement("button");
    const click = jest.spyOn(button, "click").mockImplementation(() => undefined);
    ctx.submitButtonEl = button;

    const press = (key: string): boolean => control.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));

    expect(press("a")).toBe(true);
    expect(press("Tab")).toBe(true);
    expect(click).not.toHaveBeenCalled();

    // No native <form> here, so Enter is emulated: the default is cancelled and the CTA is clicked.
    expect(press("Enter")).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);

    ctx.submitButtonEl = null;
    expect(press("Enter")).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
