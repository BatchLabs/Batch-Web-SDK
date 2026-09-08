/* eslint-env jest */

import type { ActionOutcome } from "com.batch.dom/render/contracts";
import type { MessageModel } from "com.batch.dom/render/model/model";
import { FormFieldHandle, FormSubmitRuntime, MessageFieldValue, MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import { Log } from "com.batch.shared/logger";

const SUBMIT_REF = "submit";

function makeMessage(overrides: Partial<MessageModel> = {}): MessageModel {
  return {
    format: "modal",
    position: "center",
    root: {
      configuration: {
        style: { backgroundColor: ["#FFFFFFFF"], radius: [0, 0, 0, 0], borderWidth: 0, borderColor: ["#00000000"] },
        placement: { margin: [0, 0, 0, 0] },
      },
      children: [],
    },
    closeOptions: {},
    texts: {},
    urls: {},
    actions: { [SUBMIT_REF]: { action: "batch.form.submit" } },
    eventData: {},
    ...overrides,
  };
}

interface FakeRuntime extends FormSubmitRuntime {
  setSubmitting: jest.Mock;
  showFormMessage: jest.Mock;
  clearFormMessage: jest.Mock;
  complete: jest.Mock;
}

function makeRuntime(): FakeRuntime {
  return {
    setSubmitting: jest.fn(),
    showFormMessage: jest.fn(),
    clearFormMessage: jest.fn(),
    complete: jest.fn(),
  };
}

const SUCCESS_OUTCOME: ActionOutcome = { kind: "form-feedback", status: "success" };

function makeResolver(outcome: ActionOutcome | Error = SUCCESS_OUTCOME): jest.Mock {
  return jest.fn(() => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)));
}

interface FakeField {
  handle: FormFieldHandle;
  setValue: (value: MessageFieldValue) => void;
  setValidationError: (error: string | null) => void;
  validate: jest.Mock;
  setError: jest.Mock;
  focus: jest.Mock;
  signalInvalid: jest.Mock;
}

function makeField(
  id: string,
  initial: MessageFieldValue = "",
  initialError: string | null = null,
  mapsTo: string = `${id}_map`
): FakeField {
  let value = initial;
  let validationError = initialError;
  const validate = jest.fn(() => validationError);
  const setError = jest.fn();
  const focus = jest.fn();
  const signalInvalid = jest.fn();
  return {
    setValue: next => {
      value = next;
    },
    setValidationError: error => {
      validationError = error;
    },
    validate,
    setError,
    focus,
    signalInvalid,
    handle: {
      id,
      mapsTo,
      element: document.createElement("div"),
      getValue: () => value,
      validate,
      setError,
      focus,
      signalInvalid,
    },
  };
}

describe("MessageFormController validation lifecycle", () => {
  test("validateAll surfaces the field's own validation verdict through setError", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const field = makeField("name", "", "This field is required.");
    controller.register(field.handle);

    expect(controller.validateAll()).toBe(false);
    expect(field.setError).toHaveBeenCalledWith("This field is required.");

    field.setValidationError(null);
    expect(controller.validateAll()).toBe(true);
    expect(field.setError).toHaveBeenLastCalledWith(null);
  });

  test("collectAttributes keys by mapsTo, trims strings and drops whitespace-only values", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    controller.register(makeField("name", "  Thomas  ", null, "firstname_f6g7h8").handle);
    controller.register(makeField("blank", "   ").handle);

    expect(controller.collectAttributes()).toEqual({ firstname_f6g7h8: "Thomas" });
  });

  test("collectAttributes keeps the first field of a duplicated mapsTo and warns", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    controller.register(makeField("first", "kept", null, "email_a1b2c3").handle);
    controller.register(makeField("second", "dropped", null, "email_a1b2c3").handle);

    expect(controller.collectAttributes()).toEqual({ email_a1b2c3: "kept" });
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('duplicate mapsTo "email_a1b2c3"'));
    warn.mockRestore();
  });

  test("handleBlur validates a touched field but leaves a pristine one alone", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const field = makeField("email", "", "This field is required.");
    controller.register(field.handle);

    controller.handleBlur("email");
    expect(field.setError).not.toHaveBeenCalled();

    controller.handleInput("email");
    controller.handleBlur("email");
    expect(field.setError).toHaveBeenCalledWith("This field is required.");

    field.setValidationError(null);
    controller.handleBlur("email");
    expect(field.setError).toHaveBeenLastCalledWith(null);
  });

  test("errors appear only on submit; input before submit shows nothing, and clears once corrected", async () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const field = makeField("name", "", "This field is required.");
    controller.register(field.handle);

    controller.handleInput("name");
    expect(field.setError).not.toHaveBeenCalled();

    await controller.submit();
    expect(field.setError).toHaveBeenCalledTimes(1);
    expect(field.setError).toHaveBeenCalledWith("This field is required.");

    field.setValidationError(null);
    controller.handleInput("name");
    expect(field.setError).toHaveBeenLastCalledWith(null);
  });

  test("handleInput on an unregistered id is a silent no-op", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const field = makeField("email", "", "This field is required.");
    controller.register(field.handle);

    expect(() => controller.handleInput("unknown")).not.toThrow();
    expect(field.setError).not.toHaveBeenCalled();
  });

  test("multiple invalid fields are all flagged while only the first is focused", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const first = makeField("first", "", "This field is required.");
    const second = makeField("second", "", "This field is required.");
    controller.register(first.handle);
    controller.register(second.handle);

    expect(controller.validateAll()).toBe(false);
    expect(first.setError).toHaveBeenCalledWith("This field is required.");
    expect(second.setError).toHaveBeenCalledWith("This field is required.");
    expect(first.focus).toHaveBeenCalledTimes(1);
    expect(first.signalInvalid).toHaveBeenCalledTimes(1);
    expect(second.focus).not.toHaveBeenCalled();
    expect(second.signalInvalid).not.toHaveBeenCalled();
  });

  test("registering a duplicate payload id logs a warning", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    controller.register(makeField("email").handle);
    controller.register(makeField("email").handle);
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("duplicate field id"));
    warn.mockRestore();
  });
});

describe("MessageFormController submit", () => {
  test("a valid form resolves the collected attributes and completes on success", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "success", message: "Thanks!" });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    controller.register(makeField("email", "user@example.com").handle);

    await controller.submit();

    expect(runtime.setSubmitting).toHaveBeenNthCalledWith(1, true);
    expect(runtime.clearFormMessage).toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledWith({ email_map: "user@example.com" });
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
    expect(runtime.complete).toHaveBeenCalledWith("Thanks!");
  });

  test("an error outcome surfaces the form message and per-field errors, and re-enables the form", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", message: "Please review.", fieldErrors: { email: "Rejected" } });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", "user@example.com");
    controller.register(email.handle);

    await controller.submit();

    expect(email.setError).toHaveBeenCalledWith("Rejected");
    expect(runtime.showFormMessage).toHaveBeenCalledWith("Please review.", "error");
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  test("an error outcome without per-field errors still surfaces the form message and stays editable", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", message: "Please review." });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", "user@example.com");
    controller.register(email.handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("Please review.", "error");
    expect(email.setError).not.toHaveBeenCalledWith(expect.stringContaining("Please review."));
    expect(email.setError).toHaveBeenLastCalledWith(null);
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  test("an error outcome without a message falls back to the default submit error text", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error" });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    controller.register(makeField("email", "user@example.com").handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("Something went wrong. Please try again.", "error");
    expect(runtime.complete).not.toHaveBeenCalled();
  });

  test("a rejected field without a form-level message shows only the field error and focuses it", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", fieldErrors: { email: "Rejected" } });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", "user@example.com");
    controller.register(email.handle);

    await controller.submit();

    expect(email.setError).toHaveBeenCalledWith("Rejected");
    expect(runtime.showFormMessage).not.toHaveBeenCalled();
    expect(email.focus).toHaveBeenCalledTimes(1);
    expect(email.signalInvalid).toHaveBeenCalledTimes(1);
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  test("field errors that match no rendered field fall back to the generic submit error", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", fieldErrors: { ghost: "Nope" } });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", "user@example.com");
    controller.register(email.handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("Something went wrong. Please try again.", "error");
    expect(email.setError).not.toHaveBeenCalledWith("Nope");
    expect(email.focus).not.toHaveBeenCalled();
  });

  test("a rejected submit shows a network error message and re-enables the form", async () => {
    const runtime = makeRuntime();
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, makeResolver(new Error("offline")));
    controller.register(makeField("email", "user@example.com").handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("We couldn't reach the server. Please try again.", "error");
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  test("a non-Error rejection is stringified and still shows the network error message", async () => {
    const runtime = makeRuntime();
    const controller = new MessageFormController(
      makeMessage(),
      SUBMIT_REF,
      runtime,
      jest.fn(() => Promise.reject("boom"))
    );
    controller.register(makeField("email", "user@example.com").handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("We couldn't reach the server. Please try again.", "error");
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  test("per-field errors targeting an unknown field id are ignored", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", message: "Please review.", fieldErrors: { ghost: "Nope" } });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", "user@example.com");
    controller.register(email.handle);

    await controller.submit();

    expect(email.setError).not.toHaveBeenCalledWith("Nope");
    expect(runtime.showFormMessage).toHaveBeenCalledWith("Please review.", "error");
  });

  test("a non form-feedback outcome surfaces a generic error message", async () => {
    const runtime = makeRuntime();
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, makeResolver({ kind: "none" }));
    controller.register(makeField("email", "user@example.com").handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("Something went wrong. Please try again.", "error");
    expect(runtime.complete).not.toHaveBeenCalled();
  });

  test("the network and submit error fallbacks are overridable through reserved texts keys", async () => {
    const message = makeMessage({
      texts: {
        "batch.form.error.network": "Réseau indisponible",
        "batch.form.error.submit": "Erreur générique",
      },
    });

    const networkRuntime = makeRuntime();
    const networkController = new MessageFormController(message, SUBMIT_REF, networkRuntime, makeResolver(new Error("offline")));
    networkController.register(makeField("email", "a").handle);
    await networkController.submit();
    expect(networkRuntime.showFormMessage).toHaveBeenCalledWith("Réseau indisponible", "error");

    const submitRuntime = makeRuntime();
    const submitController = new MessageFormController(message, SUBMIT_REF, submitRuntime, makeResolver({ kind: "none" }));
    submitController.register(makeField("email", "a").handle);
    await submitController.submit();
    expect(submitRuntime.showFormMessage).toHaveBeenCalledWith("Erreur générique", "error");
  });

  test("concurrent submits are guarded: only the first request is sent while in flight", async () => {
    let resolveSubmit: (outcome: ActionOutcome) => void = () => undefined;
    const resolve = jest.fn(() => new Promise<ActionOutcome>(settle => (resolveSubmit = settle)));
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), resolve);
    controller.register(makeField("email", "user@example.com").handle);

    const first = controller.submit();
    const second = controller.submit();
    expect(resolve).toHaveBeenCalledTimes(1);

    resolveSubmit(SUCCESS_OUTCOME);
    await Promise.all([first, second]);
  });

  test("submit is a no-op when there is no submit action ref", async () => {
    const resolve = makeResolver();
    const controller = new MessageFormController(makeMessage(), undefined, makeRuntime(), resolve);
    controller.register(makeField("email", "user@example.com").handle);

    await controller.submit();

    expect(resolve).not.toHaveBeenCalled();
  });

  test("submit on an invalid form does not post and focuses the first invalid field", async () => {
    const resolve = makeResolver();
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), resolve);
    const first = makeField("first", "", "This field is required.");
    const second = makeField("second", "", "This field is required.");
    controller.register(first.handle);
    controller.register(second.handle);

    await controller.submit();

    expect(resolve).not.toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalled();
    expect(first.signalInvalid).toHaveBeenCalled();
    expect(second.focus).not.toHaveBeenCalled();
    expect(second.signalInvalid).not.toHaveBeenCalled();
  });

  test("a submit resolving after dispose() touches no runtime hook and never rejects", async () => {
    const runtime = makeRuntime();
    let resolveSubmit: (outcome: ActionOutcome) => void = () => undefined;
    const resolve = jest.fn(() => new Promise<ActionOutcome>(r => (resolveSubmit = r)));
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    controller.register(makeField("email", "user@example.com").handle);

    const pending = controller.submit();
    expect(runtime.setSubmitting).toHaveBeenCalledWith(true);

    controller.dispose();
    resolveSubmit(SUCCESS_OUTCOME);
    await expect(pending).resolves.toBeUndefined();

    expect(runtime.complete).not.toHaveBeenCalled();
    expect(runtime.showFormMessage).not.toHaveBeenCalled();
    expect(runtime.setSubmitting).not.toHaveBeenCalledWith(false);
  });

  test("a submit rejecting after dispose() shows no error on the detached DOM", async () => {
    const runtime = makeRuntime();
    let rejectSubmit: (reason: Error) => void = () => undefined;
    const resolve = jest.fn(() => new Promise<ActionOutcome>((_, r) => (rejectSubmit = r)));
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    controller.register(makeField("email", "user@example.com").handle);

    const pending = controller.submit();
    controller.dispose();
    rejectSubmit(new Error("offline"));
    await expect(pending).resolves.toBeUndefined();

    expect(runtime.showFormMessage).not.toHaveBeenCalled();
    expect(runtime.setSubmitting).not.toHaveBeenCalledWith(false);
  });

  test("a disposed controller refuses a new submit", async () => {
    const resolve = makeResolver();
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), resolve);
    controller.register(makeField("email", "user@example.com").handle);

    controller.dispose();
    await controller.submit();

    expect(resolve).not.toHaveBeenCalled();
  });
});
