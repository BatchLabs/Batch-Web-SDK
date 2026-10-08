/* eslint-env jest */

import type { MessageValidationModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { createErrorNode, createFieldWrapper, registerField } from "com.batch.dom/render/render/components/field-helpers";
import type { FormFieldHandle } from "com.batch.dom/render/render/field-protocol";
import type { MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import { componentMessage } from "com.batch.dom/render/test-utils/prop-matrix";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

const FIELD_ID = "email";
const FIELD_MAP_TO = "email_map";
const DOM_ID = "email-t";
const ERROR_CLASS = "iam-input--error";
const SHAKE_CLASS = "iam-field-shake";

const REQUIRED_KEY = "batch.form.error.required";
const INVALID_KEY = "batch.form.error.invalid";
const INVALID_EMAIL_KEY = "batch.form.error.invalid.email";

const DEFAULT_REQUIRED_MESSAGE = "This field is required.";
const DEFAULT_INVALID_MESSAGE = "This value is invalid.";

const NEVER_MATCHES: MessageValidationModel = { regex: "^$a" };

interface SetupOptions {
  texts?: Record<string, string>;
  required?: boolean;
  validation?: MessageValidationModel;
  minLength?: number;
  invalidTextKey?: string;
}

interface Registered {
  handle: FormFieldHandle;
  control: HTMLInputElement;
  wrapper: HTMLElement;
  errorNode: HTMLElement;
}

/** `registerField` options the setup shortcut does not model, passed through as is. */
type RegisterOverrides = Partial<Parameters<typeof registerField>[0]>;

function register(options: SetupOptions = {}, overrides: RegisterOverrides = {}): Registered {
  const message = normalizeMessage(componentMessage({ type: "field", id: FIELD_ID, mapsTo: FIELD_MAP_TO }, { texts: options.texts ?? {} }));
  const captured: FormFieldHandle[] = [];
  const controller = { register: (handle: FormFieldHandle) => captured.push(handle) } as unknown as MessageFormController;

  const wrapper = createFieldWrapper("input");
  const control = document.createElement("input");
  const errorNode = createErrorNode(DOM_ID);
  wrapper.appendChild(control);
  wrapper.appendChild(errorNode);

  registerField({
    controller,
    message,
    id: FIELD_ID,
    mapsTo: FIELD_MAP_TO,
    required: options.required ?? false,
    regexes: options.validation?.regex !== undefined ? [options.validation.regex] : undefined,
    errorTextId: options.validation?.errorId,
    minLength: options.minLength,
    invalidTextKey: options.invalidTextKey,
    control,
    element: wrapper,
    errorNode,
    errorClass: ERROR_CLASS,
    getValue: () => ({ type: ProfileAttributeType.STRING, value: control.value }),
    ...overrides,
  });

  return { handle: captured[0], control, wrapper, errorNode };
}

function validateWith(value: string, options: SetupOptions = {}, overrides: RegisterOverrides = {}): string | null {
  const { handle, control } = register(options, overrides);
  control.value = value;
  return handle.validate();
}

describe("createFieldWrapper", () => {
  test("carries the shared field class plus the per-type modifier", () => {
    const wrapper = createFieldWrapper("input");
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toBe("iam-field iam-field-input");
  });

  test("wraps a group in a fieldset when asked, keeping the same class list", () => {
    const wrapper = createFieldWrapper("choice", "fieldset");
    expect(wrapper.tagName).toBe("FIELDSET");
    expect(wrapper.className).toBe("iam-field iam-field-choice");
  });
});

describe("createErrorNode", () => {
  test("is an empty alert paragraph whose id derives from the scoped field id", () => {
    const node = createErrorNode(DOM_ID);
    expect(node.tagName).toBe("P");
    expect(node.className).toBe("iam-field-error");
    expect(node.id).toBe("email-t-error");
    expect(node.getAttribute("role")).toBe("alert");
    expect(node.textContent).toBe("");
    expect(node.classList.contains("iam-field-error--visible")).toBe(false);
  });
});

describe("registerField", () => {
  test("registers a handle exposing the payload id, the field element and the live value", () => {
    const { handle, control, wrapper } = register();
    control.value = "typed";
    expect(handle.id).toBe(FIELD_ID);
    expect(handle.element).toBe(wrapper);
    expect(handle.getValue()).toEqual({ type: ProfileAttributeType.STRING, value: "typed" });
  });
});

describe("field validation rules", () => {
  test("a required field rejects an empty value and accepts any content", () => {
    expect(validateWith("", { required: true })).toBe(DEFAULT_REQUIRED_MESSAGE);
    expect(validateWith("x", { required: true })).toBeNull();
  });

  test("a required field treats a whitespace-only value as empty", () => {
    expect(validateWith("   \t ", { required: true })).toBe(DEFAULT_REQUIRED_MESSAGE);
  });

  test("an optional field accepts an empty value even when a format rule is declared", () => {
    expect(validateWith("", { validation: NEVER_MATCHES })).toBeNull();
    expect(validateWith("", { minLength: 4 })).toBeNull();
  });

  test("minLength rejects strictly shorter values and accepts the bound itself", () => {
    expect(validateWith("abc", { minLength: 4 })).toBe(DEFAULT_INVALID_MESSAGE);
    expect(validateWith("abcd", { minLength: 4 })).toBeNull();
  });

  test("a whitespace-only value is long enough for minLength: only required trims", () => {
    expect(validateWith("    ", { minLength: 4 })).toBeNull();
  });

  test("a regex verdict applies to non-empty values", () => {
    expect(validateWith("abc", { validation: { regex: "^[0-9]+$" } })).toBe(DEFAULT_INVALID_MESSAGE);
    expect(validateWith("123", { validation: { regex: "^[0-9]+$" } })).toBeNull();
  });

  test("emptiness is reported before format on a required field", () => {
    const texts = { [REQUIRED_KEY]: "Champ obligatoire", [INVALID_KEY]: "Valeur invalide" };
    expect(validateWith("", { required: true, validation: NEVER_MATCHES, minLength: 4, texts })).toBe("Champ obligatoire");
  });

  test("a value matching the format is still rejected when it is too short", () => {
    expect(validateWith("ab", { minLength: 4, validation: { regex: "^[a-z]+$" } })).toBe(DEFAULT_INVALID_MESSAGE);
  });

  test("maxLength rejects strictly longer values and accepts the bound itself", () => {
    expect(validateWith("abcde", {}, { maxLength: 5 })).toBeNull();
    expect(validateWith("abcdef", {}, { maxLength: 5 })).toBe(DEFAULT_INVALID_MESSAGE);
  });

  test("the kind has the last word on a non-empty value that every pattern accepted", () => {
    const accepts = jest.fn((_text: string) => false);
    expect(validateWith("abc", {}, { accepts })).toBe(DEFAULT_INVALID_MESSAGE);
    expect(accepts).toHaveBeenCalledWith("abc");

    accepts.mockClear();
    expect(validateWith("", {}, { accepts })).toBeNull();
    expect(accepts).not.toHaveBeenCalled();
  });

  test("without validatedText a typed value validates as empty", () => {
    const typed = { getValue: () => ({ type: ProfileAttributeType.INTEGER, value: 3 }) } satisfies RegisterOverrides;
    expect(validateWith("3", { required: true }, typed)).toBe(DEFAULT_REQUIRED_MESSAGE);
    expect(validateWith("3", { required: true }, { ...typed, validatedText: () => "3" })).toBeNull();
  });

  test("a control holding nothing validates as empty, never throws", () => {
    const empty = { getValue: () => null } satisfies RegisterOverrides;
    expect(register({ required: true }, empty).handle.validate()).toBe(DEFAULT_REQUIRED_MESSAGE);
    expect(register({ required: false }, empty).handle.validate()).toBeNull();
  });

  test("a malformed pattern is skipped, never fatal", () => {
    expect(validateWith("abc", {}, { regexes: ["(["] })).toBeNull();
    expect(validateWith("abc", {}, { regexes: ["([", "^[0-9]+$"] })).toBe(DEFAULT_INVALID_MESSAGE);
  });
});

interface CascadeCase {
  name: string;
  texts: Record<string, string>;
  validation?: MessageValidationModel;
  invalidTextKey?: string;
  expected: string;
}

const INVALID_CASCADE: CascadeCase[] = [
  {
    name: "no texts at all falls back to the built-in English default",
    texts: {},
    expected: DEFAULT_INVALID_MESSAGE,
  },
  {
    name: "the generic invalid key overrides the built-in default",
    texts: { [INVALID_KEY]: "Valeur invalide" },
    expected: "Valeur invalide",
  },
  {
    name: "the type-specific key wins over the generic one",
    texts: { [INVALID_KEY]: "Valeur invalide", [INVALID_EMAIL_KEY]: "Email invalide" },
    invalidTextKey: INVALID_EMAIL_KEY,
    expected: "Email invalide",
  },
  {
    name: "a type-specific key with no text entry falls through to the generic one",
    texts: { [INVALID_KEY]: "Valeur invalide" },
    invalidTextKey: INVALID_EMAIL_KEY,
    expected: "Valeur invalide",
  },
  {
    name: "the payload errorId wins over both reserved keys",
    texts: { custom: "Format attendu : nom@domaine.fr", [INVALID_KEY]: "Valeur invalide", [INVALID_EMAIL_KEY]: "Email invalide" },
    validation: { errorId: "custom" },
    invalidTextKey: INVALID_EMAIL_KEY,
    expected: "Format attendu : nom@domaine.fr",
  },
  {
    name: "an errorId pointing at a missing text entry falls through to the reserved keys",
    texts: { [INVALID_KEY]: "Valeur invalide" },
    validation: { errorId: "absent" },
    expected: "Valeur invalide",
  },
  {
    name: "an empty text entry is not a message: the cascade keeps falling through",
    texts: { custom: "", [INVALID_EMAIL_KEY]: "", [INVALID_KEY]: "" },
    validation: { errorId: "custom" },
    invalidTextKey: INVALID_EMAIL_KEY,
    expected: DEFAULT_INVALID_MESSAGE,
  },
];

describe("field error message cascade", () => {
  test.each(INVALID_CASCADE)("format error: $name", ({ texts, validation, invalidTextKey, expected }) => {
    const options: SetupOptions = {
      texts,
      invalidTextKey,
      validation: { ...NEVER_MATCHES, ...validation },
    };
    expect(validateWith("anything", options)).toBe(expected);
  });

  test("the required message follows the same cascade, with its own reserved key", () => {
    expect(validateWith("", { required: true, texts: { [REQUIRED_KEY]: "Champ obligatoire" } })).toBe("Champ obligatoire");
    expect(validateWith("", { required: true, texts: { [REQUIRED_KEY]: "" } })).toBe(DEFAULT_REQUIRED_MESSAGE);
  });

  test("the required message prefers the payload errorId over the reserved key", () => {
    const texts = { custom: "Merci de renseigner votre email", [REQUIRED_KEY]: "Champ obligatoire" };
    expect(validateWith("", { required: true, validation: { errorId: "custom" }, texts })).toBe("Merci de renseigner votre email");
  });

  test("the generic invalid key does not leak into the required message", () => {
    expect(validateWith("", { required: true, texts: { [INVALID_KEY]: "Valeur invalide" } })).toBe(DEFAULT_REQUIRED_MESSAGE);
  });
});

describe("field error UI", () => {
  test("showing an error wires the class, the aria pair and the visible message", () => {
    const { handle, control, errorNode } = register();
    handle.setError("Email invalide");

    expect(control.classList.contains(ERROR_CLASS)).toBe(true);
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe(errorNode.id);
    expect(errorNode.textContent).toBe("Email invalide");
    expect(errorNode.classList.contains("iam-field-error--visible")).toBe(true);
  });

  test("clearing an error removes the class and both aria attributes but keeps the text", () => {
    const { handle, control, errorNode } = register();
    handle.setError("Email invalide");
    handle.setError(null);

    expect(control.classList.contains(ERROR_CLASS)).toBe(false);
    expect(control.hasAttribute("aria-invalid")).toBe(false);
    expect(control.hasAttribute("aria-describedby")).toBe(false);
    expect(errorNode.classList.contains("iam-field-error--visible")).toBe(false);
    expect(errorNode.textContent).toBe("Email invalide");
  });

  test("a second error replaces the previous copy", () => {
    const { handle, errorNode } = register();
    handle.setError("Email invalide");
    handle.setError(null);
    handle.setError("Champ obligatoire");

    expect(errorNode.textContent).toBe("Champ obligatoire");
    expect(errorNode.classList.contains("iam-field-error--visible")).toBe(true);
  });
});

describe("field focus", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("focus moves the caret to the control and centers it in the viewport", () => {
    const { handle, control, wrapper } = register();
    document.body.appendChild(wrapper);
    const scrollIntoView = jest.fn();
    (control as unknown as { scrollIntoView: unknown }).scrollIntoView = scrollIntoView;

    handle.focus();

    expect(document.activeElement).toBe(control);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });
});

describe("field rejection signal", () => {
  test("the shake class lands on the field wrapper, not on the control", () => {
    const { handle, control, wrapper } = register();
    handle.signalInvalid();

    expect(wrapper.classList.contains(SHAKE_CLASS)).toBe(true);
    expect(control.classList.contains(SHAKE_CLASS)).toBe(false);
  });

  test("signalling twice in a row leaves the class applied so the animation can restart", () => {
    const { handle, wrapper } = register();
    handle.signalInvalid();
    handle.signalInvalid();

    expect(wrapper.classList.contains(SHAKE_CLASS)).toBe(true);
  });

  test("outside a field wrapper the shake lands on the element itself", () => {
    const bare = document.createElement("div");
    const { handle, wrapper } = register({}, { element: bare });

    handle.signalInvalid();

    expect(handle.element).toBe(bare);
    expect(bare.classList.contains(SHAKE_CLASS)).toBe(true);
    expect(wrapper.classList.contains(SHAKE_CLASS)).toBe(false);
  });
});
