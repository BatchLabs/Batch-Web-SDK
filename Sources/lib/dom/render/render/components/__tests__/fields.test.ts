/* eslint-env jest */

import type { MessageInputModel, MessageModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageInputPayload } from "com.batch.dom/render/model/types";
import { renderInput } from "com.batch.dom/render/render/components/input";
import type { FormRenderContext } from "com.batch.dom/render/render/form-setup";
import { MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import { componentMessage, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";

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
    expect(padded.ctx.form?.collectAttributes()).toEqual({ email_map: "user@example.com" });
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
});
