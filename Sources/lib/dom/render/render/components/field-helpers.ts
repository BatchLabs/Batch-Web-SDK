import type { MessageModel, MessageValidationModel } from "com.batch.dom/render/model/model";
import { RENDER_TEXT_KEY_FORM_INVALID_ERROR, RENDER_TEXT_KEY_FORM_REQUIRED_ERROR } from "com.batch.dom/render/render-constants";
import type { FormFieldHandle, MessageFieldValue } from "com.batch.dom/render/render/field-protocol";
import type { MessageFormController } from "com.batch.dom/render/runtime/form-controller";

import { createElement } from "../component-helpers";

const DEFAULT_REQUIRED_MESSAGE = "This field is required.";
const DEFAULT_INVALID_MESSAGE = "This value is invalid.";

const SHOW_FIELD_ERROR_MESSAGE = true;

export function createFieldWrapper(modifier: string): HTMLElement {
  const wrapper = createElement("div", `iam-field iam-field-${modifier}`);
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  return wrapper;
}

export function createErrorNode(domId: string): HTMLElement {
  const node = createElement("p", "iam-field-error");
  node.id = `${domId}-error`;
  node.setAttribute("role", "alert");
  // Stays in the DOM, collapsed with a CSS max-height, so show and hide animate the height.
  return node;
}

interface RegisterFieldOptions {
  controller: MessageFormController;
  message: MessageModel;
  id: string;
  /** Payload key of the submitted value. See {@link FormFieldHandle.mapsTo}. */
  mapsTo: string;
  required: boolean;
  /** Custom format rule the serving payload carries. It never replaces a native rule. */
  validation?: MessageValidationModel;
  nativeRegexes?: readonly string[];
  maxLength?: number;
  /** Minimum accepted value length. Like the regex check, it applies only to non-empty values. */
  minLength?: number;
  /** Type-specific "invalid" `texts` key for email and phone. It comes before the generic invalid key. */
  invalidTextKey?: string;
  control: HTMLElement;
  element: HTMLElement;
  errorNode: HTMLElement;
  errorClass: string;
  getValue: () => MessageFieldValue;
}

function compileRegex(source: string): RegExp | null {
  try {
    return new RegExp(source);
  } catch (_e) {
    return null;
  }
}

/** Wires a rendered text control to the form controller with its validation and error UI. */
export function registerField(options: RegisterFieldOptions): void {
  const {
    controller,
    message,
    id,
    mapsTo,
    required,
    validation,
    nativeRegexes,
    maxLength,
    minLength,
    invalidTextKey,
    control,
    element,
    errorNode,
    errorClass,
    getValue,
  } = options;

  if (required) {
    control.setAttribute("aria-required", "true");
  }

  const resolveError = (fallbackKeys: string[], fallback: string): string => {
    const candidates = [
      validation?.errorId ? message.texts[validation.errorId] : undefined,
      ...fallbackKeys.map(key => message.texts[key]),
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }
    return fallback;
  };

  // Cascade: payload `errorId`, then the type-specific key, then the generic invalid key.
  const invalidKeys = invalidTextKey ? [invalidTextKey, RENDER_TEXT_KEY_FORM_INVALID_ERROR] : [RENDER_TEXT_KEY_FORM_INVALID_ERROR];

  const handle: FormFieldHandle = {
    id,
    mapsTo,
    element,
    getValue,
    validate(): string | null {
      // Validate the trimmed value: the controller trims before collecting.
      const value = getValue().trim();
      if (required && value.length === 0) {
        return resolveError([RENDER_TEXT_KEY_FORM_REQUIRED_ERROR], DEFAULT_REQUIRED_MESSAGE);
      }
      if (maxLength !== undefined && value.length > maxLength) {
        return resolveError(invalidKeys, DEFAULT_INVALID_MESSAGE);
      }
      if (minLength !== undefined && value.length > 0 && value.length < minLength) {
        return resolveError(invalidKeys, DEFAULT_INVALID_MESSAGE);
      }
      if (value.length > 0) {
        const sources = validation?.regex ? [...(nativeRegexes ?? []), validation.regex] : (nativeRegexes ?? []);
        for (const source of sources) {
          const compiled = compileRegex(source);
          if (compiled && !compiled.test(value)) {
            return resolveError(invalidKeys, DEFAULT_INVALID_MESSAGE);
          }
        }
      }
      return null;
    },
    setError(errorMessage: string | null): void {
      if (errorMessage === null) {
        control.classList.remove(errorClass);
        control.removeAttribute("aria-invalid");
        control.removeAttribute("aria-describedby");
        // Keep the text during the collapse transition. The node stays in the DOM.
        errorNode.classList.remove("iam-field-error--visible");
        return;
      }
      control.classList.add(errorClass);
      control.setAttribute("aria-invalid", "true");
      control.setAttribute("aria-describedby", errorNode.id);
      errorNode.textContent = errorMessage;
      if (SHOW_FIELD_ERROR_MESSAGE) {
        errorNode.classList.add("iam-field-error--visible");
      }
    },
    focus(): void {
      control.focus();
      if (typeof control.scrollIntoView === "function") {
        control.scrollIntoView({ block: "center" });
      }
    },
    signalInvalid(): void {
      const target = (control.closest(".iam-field") as HTMLElement | null) ?? control;
      target.classList.remove("iam-field-shake");
      // Force a reflow so the animation restarts on every rejected submit.
      void target.offsetWidth;
      target.classList.add("iam-field-shake");
    },
  };

  controller.register(handle);
}
