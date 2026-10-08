/* eslint-env jest */

import type { ActionOutcome } from "com.batch.dom/render/contracts";
import type { MessageModel } from "com.batch.dom/render/model/model";
import { FormFieldHandle, FormSubmitRuntime, MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

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
  setValue: (value: FormFieldValue | null) => void;
  setValidationError: (error: string | null) => void;
  validate: jest.Mock;
  setError: jest.Mock;
  focus: jest.Mock;
  signalInvalid: jest.Mock;
}

function makeField(
  id: string,
  initial: FormFieldValue | null = { type: ProfileAttributeType.STRING, value: "" },
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
    const field = makeField("name", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
    controller.register(field.handle);

    expect(controller.validateAll()).toBe(false);
    expect(field.setError).toHaveBeenCalledWith("This field is required.");

    field.setValidationError(null);
    expect(controller.validateAll()).toBe(true);
    expect(field.setError).toHaveBeenLastCalledWith(null);
  });

  test("collectAttributes keys by mapsTo, trims strings and drops whitespace-only values", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    controller.register(makeField("name", { type: ProfileAttributeType.STRING, value: "  Thomas  " }, null, "firstname_f6g7h8").handle);
    controller.register(makeField("blank", { type: ProfileAttributeType.STRING, value: "   " }).handle);

    expect(controller.collectAttributes()).toEqual({ firstname_f6g7h8: { type: ProfileAttributeType.STRING, value: "Thomas" } });
  });

  test("collectAttributes always reports a boolean, `false` included", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    controller.register(makeField("optin", { type: ProfileAttributeType.BOOLEAN, value: true }, null, "newsletter").handle);
    controller.register(makeField("optout", { type: ProfileAttributeType.BOOLEAN, value: false }, null, "partners").handle);

    expect(controller.collectAttributes()).toEqual({
      newsletter: { type: ProfileAttributeType.BOOLEAN, value: true },
      partners: { type: ProfileAttributeType.BOOLEAN, value: false },
    });
  });

  test("collectAttributes keeps a partial array update that carries at least one value and drops an empty one", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    controller.register(
      makeField("picked", { type: ProfileAttributeType.ARRAY, value: { $add: ["tennis"], $remove: ["golf"] } }, null, "sports").handle
    );
    controller.register(makeField("added", { type: ProfileAttributeType.ARRAY, value: { $add: ["running"] } }, null, "hobbies").handle);
    controller.register(
      makeField("untouched", { type: ProfileAttributeType.ARRAY, value: { $add: [], $remove: [] } }, null, "topics").handle
    );

    expect(controller.collectAttributes()).toEqual({
      sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["tennis"], $remove: ["golf"] } },
      hobbies: { type: ProfileAttributeType.ARRAY, value: { $add: ["running"] } },
    });
  });

  test("collectAttributes carries a date, a url and both typed numbers as they are, and drops a field holding nothing", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const when = new Date("1988-04-12T00:00:00.000Z");
    const site = new URL("https://batch.com/pricing");
    controller.register(makeField("born", { type: ProfileAttributeType.DATE, value: when }, null, "birthdate").handle);
    controller.register(makeField("site", { type: ProfileAttributeType.URL, value: site }, null, "website").handle);
    controller.register(makeField("budget", { type: ProfileAttributeType.FLOAT, value: 2 }, null, "budget").handle);
    controller.register(makeField("visits", { type: ProfileAttributeType.INTEGER, value: 42 }, null, "visit_count").handle);
    controller.register(makeField("empty", null, null, "nothing").handle);

    expect(controller.collectAttributes()).toEqual({
      birthdate: { type: ProfileAttributeType.DATE, value: when },
      website: { type: ProfileAttributeType.URL, value: site },
      budget: { type: ProfileAttributeType.FLOAT, value: 2 },
      visit_count: { type: ProfileAttributeType.INTEGER, value: 42 },
    });
  });

  test("a field with no profile target validates but writes nothing", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const barrier = makeField("terms", { type: ProfileAttributeType.BOOLEAN, value: true }, "You must accept the terms.");
    controller.register({ ...barrier.handle, mapsTo: undefined });
    const blank = makeField("nickname", { type: ProfileAttributeType.STRING, value: "typed" }, null, "");
    controller.register(blank.handle);
    controller.register(makeField("named", { type: ProfileAttributeType.STRING, value: "kept" }, null, "firstname").handle);

    expect(controller.collectAttributes()).toEqual({ firstname: { type: ProfileAttributeType.STRING, value: "kept" } });
    expect(controller.validateAll()).toBe(false);
    expect(barrier.setError).toHaveBeenCalledWith("You must accept the terms.");
    expect(blank.validate).toHaveBeenCalled();
  });

  test("collectAttributes keeps the first field of a duplicated mapsTo and warns", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    controller.register(makeField("first", { type: ProfileAttributeType.STRING, value: "kept" }, null, "email_a1b2c3").handle);
    controller.register(makeField("second", { type: ProfileAttributeType.STRING, value: "dropped" }, null, "email_a1b2c3").handle);

    expect(controller.collectAttributes()).toEqual({ email_a1b2c3: { type: ProfileAttributeType.STRING, value: "kept" } });
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('duplicate mapsTo "email_a1b2c3"'));
    warn.mockRestore();
  });

  test("handleBlur validates a touched field but leaves a pristine one alone", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const field = makeField("email", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
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
    const field = makeField("name", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
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
    const field = makeField("email", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
    controller.register(field.handle);

    expect(() => controller.handleInput("unknown")).not.toThrow();
    expect(field.setError).not.toHaveBeenCalled();
  });

  test("multiple invalid fields are all flagged while only the first is focused", () => {
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), makeResolver());
    const first = makeField("first", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
    const second = makeField("second", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
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
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

    await controller.submit();

    expect(runtime.setSubmitting).toHaveBeenNthCalledWith(1, true);
    expect(runtime.clearFormMessage).toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledWith({ email_map: { type: ProfileAttributeType.STRING, value: "user@example.com" } });
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
    expect(runtime.complete).toHaveBeenCalledWith("Thanks!");
  });

  test("an error outcome surfaces the form message and per-field errors, and re-enables the form", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", message: "Please review.", fieldErrors: { email: "Rejected" } });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" });
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
    const email = makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" });
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
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("Something went wrong. Please try again.", "error");
    expect(runtime.complete).not.toHaveBeenCalled();
  });

  test("a rejected field without a form-level message shows only the field error and focuses it", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", fieldErrors: { email: "Rejected" } });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" });
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
    const email = makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" });
    controller.register(email.handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("Something went wrong. Please try again.", "error");
    expect(email.setError).not.toHaveBeenCalledWith("Nope");
    expect(email.focus).not.toHaveBeenCalled();
  });

  test("a rejected submit shows a network error message and re-enables the form", async () => {
    const runtime = makeRuntime();
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, makeResolver(new Error("offline")));
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

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
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("We couldn't reach the server. Please try again.", "error");
    expect(runtime.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  test("per-field errors targeting an unknown field id are ignored", async () => {
    const runtime = makeRuntime();
    const resolve = makeResolver({ kind: "form-feedback", status: "error", message: "Please review.", fieldErrors: { ghost: "Nope" } });
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, resolve);
    const email = makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" });
    controller.register(email.handle);

    await controller.submit();

    expect(email.setError).not.toHaveBeenCalledWith("Nope");
    expect(runtime.showFormMessage).toHaveBeenCalledWith("Please review.", "error");
  });

  test("a non form-feedback outcome surfaces a generic error message", async () => {
    const runtime = makeRuntime();
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, makeResolver({ kind: "none" }));
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

    await controller.submit();

    expect(runtime.showFormMessage).toHaveBeenCalledWith("Something went wrong. Please try again.", "error");
    expect(runtime.complete).not.toHaveBeenCalled();
  });

  test("an outcome of another kind is never read as a form verdict, even when it carries one", async () => {
    const runtime = makeRuntime();
    // A custom action registered from plain JS returns an unvalidated outcome: it can carry a success verdict under another kind.
    const rogue = { kind: "dismiss", status: "success", message: "Thanks!" } as unknown as ActionOutcome;
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, runtime, makeResolver(rogue));
    const email = makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" });
    controller.register(email.handle);

    await controller.submit();

    expect(runtime.complete).not.toHaveBeenCalled();
    expect(runtime.showFormMessage).toHaveBeenCalledTimes(1);
    expect(runtime.showFormMessage).toHaveBeenCalledWith("Something went wrong. Please try again.", "error");
    expect(email.setError).not.toHaveBeenCalledWith("Thanks!");
    expect(controller.acceptsSubmit).toBe(true);
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
    networkController.register(makeField("email", { type: ProfileAttributeType.STRING, value: "a" }).handle);
    await networkController.submit();
    expect(networkRuntime.showFormMessage).toHaveBeenCalledWith("Réseau indisponible", "error");

    const submitRuntime = makeRuntime();
    const submitController = new MessageFormController(message, SUBMIT_REF, submitRuntime, makeResolver({ kind: "none" }));
    submitController.register(makeField("email", { type: ProfileAttributeType.STRING, value: "a" }).handle);
    await submitController.submit();
    expect(submitRuntime.showFormMessage).toHaveBeenCalledWith("Erreur générique", "error");
  });

  test("concurrent submits are guarded: only the first request is sent while in flight", async () => {
    let resolveSubmit: (outcome: ActionOutcome) => void = () => undefined;
    const resolve = jest.fn(() => new Promise<ActionOutcome>(settle => (resolveSubmit = settle)));
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), resolve);
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

    const first = controller.submit();
    const second = controller.submit();
    expect(resolve).toHaveBeenCalledTimes(1);

    resolveSubmit(SUCCESS_OUTCOME);
    await Promise.all([first, second]);
  });

  test("submit is a no-op when there is no submit action ref", async () => {
    const resolve = makeResolver();
    const controller = new MessageFormController(makeMessage(), undefined, makeRuntime(), resolve);
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

    await controller.submit();

    expect(resolve).not.toHaveBeenCalled();
  });

  test("submit on an invalid form does not post and focuses the first invalid field", async () => {
    const resolve = makeResolver();
    const controller = new MessageFormController(makeMessage(), SUBMIT_REF, makeRuntime(), resolve);
    const first = makeField("first", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
    const second = makeField("second", { type: ProfileAttributeType.STRING, value: "" }, "This field is required.");
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
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

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
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

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
    controller.register(makeField("email", { type: ProfileAttributeType.STRING, value: "user@example.com" }).handle);

    controller.dispose();
    await controller.submit();

    expect(resolve).not.toHaveBeenCalled();
  });
});
