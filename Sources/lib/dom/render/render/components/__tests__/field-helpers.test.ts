/* eslint-env jest */

import type { MessageValidationModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { createErrorNode, createFieldWrapper, registerField } from "com.batch.dom/render/render/components/field-helpers";
import type { FormFieldHandle } from "com.batch.dom/render/render/field-protocol";
import type { MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import { componentMessage } from "com.batch.dom/render/test-utils/prop-matrix";

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
  detached?: boolean;
}

interface Registered {
  handle: FormFieldHandle;
  control: HTMLInputElement;
  wrapper: HTMLElement;
  errorNode: HTMLElement;
}

function register(options: SetupOptions = {}): Registered {
  const message = normalizeMessage(componentMessage({ type: "field", id: FIELD_ID, mapsTo: FIELD_MAP_TO }, { texts: options.texts ?? {} }));
  const captured: FormFieldHandle[] = [];
  const controller = { register: (handle: FormFieldHandle) => captured.push(handle) } as unknown as MessageFormController;

  const wrapper = createFieldWrapper("input");
  const control = document.createElement("input");
  const errorNode = createErrorNode(DOM_ID);
  if (!options.detached) {
    wrapper.appendChild(control);
  }
  wrapper.appendChild(errorNode);

  registerField({
    controller,
    message,
    id: FIELD_ID,
    mapsTo: FIELD_MAP_TO,
    required: options.required ?? false,
    validation: options.validation,
    minLength: options.minLength,
    invalidTextKey: options.invalidTextKey,
    control,
    element: wrapper,
    errorNode,
    errorClass: ERROR_CLASS,
    getValue: () => control.value,
  });

  return { handle: captured[0], control, wrapper, errorNode };
}

function validateWith(value: string, options: SetupOptions = {}): string | null {
  const { handle, control } = register(options);
  control.value = value;
  return handle.validate();
}

describe("createFieldWrapper", () => {
  test("carries the shared field class plus the per-type modifier and stacks its children", () => {
    const wrapper = createFieldWrapper("input");
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toBe("iam-field iam-field-input");
    expect(wrapper.style.display).toBe("flex");
    expect(wrapper.style.flexDirection).toBe("column");
  });

  test("the modifier is the only variable part of the class list", () => {
    expect(createFieldWrapper("checkbox").className).toBe("iam-field iam-field-checkbox");
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
    expect(handle.getValue()).toBe("typed");
  });

  test("aria-required is stamped for a required field only", () => {
    expect(register({ required: true }).control.getAttribute("aria-required")).toBe("true");
    expect(register({ required: false }).control.hasAttribute("aria-required")).toBe(false);
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

  test("a control with no field ancestor shakes itself", () => {
    const { handle, control } = register({ detached: true });
    handle.signalInvalid();

    expect(control.classList.contains(SHAKE_CLASS)).toBe(true);
  });

  test("signalling twice in a row leaves the class applied so the animation can restart", () => {
    const { handle, wrapper } = register();
    handle.signalInvalid();
    handle.signalInvalid();

    expect(wrapper.classList.contains(SHAKE_CLASS)).toBe(true);
  });
});
