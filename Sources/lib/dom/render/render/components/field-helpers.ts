import type { MessageFieldLabel, MessageModel } from "com.batch.dom/render/model/model";
import type { MessageColor } from "com.batch.dom/render/model/types";
import { RENDER_TEXT_KEY_FORM_INVALID_ERROR, RENDER_TEXT_KEY_FORM_REQUIRED_ERROR } from "com.batch.dom/render/render-constants";
import type { FormFieldHandle } from "com.batch.dom/render/render/field-protocol";
import type { MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { createElement } from "../component-helpers";
import { applyResponsiveLength, applyThemePair, isTransparentColor } from "../dom-utils";

const DEFAULT_REQUIRED_MESSAGE = "This field is required.";
const DEFAULT_INVALID_MESSAGE = "This value is invalid.";

const SHOW_FIELD_ERROR_MESSAGE = true;

export function createFieldWrapper(modifier: string, tag: "div" | "fieldset" = "div"): HTMLElement {
  const wrapper = createElement(tag, `iam-field iam-field-${modifier}`);
  return wrapper;
}

interface FieldLabelOptions {
  /** `legend` names a `fieldset` group; `label` links to a single control through `htmlFor`. */
  tag: "label" | "legend";
  htmlFor?: string;
  text: string;
  required: boolean;
  label: MessageFieldLabel;
}

/** A hidden label stays in the DOM: the `label[for]`/`legend` link is what names the control. */
export function renderFieldLabel(options: FieldLabelOptions): HTMLElement {
  const label = createElement(options.tag, "iam-field-label");
  if (options.htmlFor !== undefined && label instanceof HTMLLabelElement) {
    label.htmlFor = options.htmlFor;
  }
  label.textContent = options.text;
  if (options.label.labelVisible) {
    label.setAttribute("aria-label", options.text);
    if (options.required) {
      // The star is `aria-hidden`: `aria-required` on the control carries the semantics.
      const marker = createElement("span", "iam-field-label-required");
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = "*";
      label.append(marker);
    }
  } else {
    label.classList.add("iam-field-label--hidden");
  }
  applyThemePair(label, "iam-label-color", options.label.labelColor, "inherit");
  applyResponsiveLength(label, "iam-label-font-size", options.label.labelFontSize, options.label.labelFontSizeDesktop);
  return label;
}

const FOCUS_VEIL_LIGHT = "rgba(0, 0, 0, 0.32)";
const FOCUS_VEIL_DARK = "rgba(255, 255, 255, 0.32)";

/** Returns `false` when the element draws no visible border: there is no ring to thicken. */
export function applyFocusVeil(el: HTMLElement, style: { borderColor: MessageColor; borderWidth: number }): boolean {
  const [light, dark = light] = style.borderColor;
  if (style.borderWidth <= 0 || isTransparentColor(light) || isTransparentColor(dark)) {
    return false;
  }
  el.style.setProperty("--iam-focus-veil", FOCUS_VEIL_LIGHT);
  el.style.setProperty("--iam-focus-veil-dark", FOCUS_VEIL_DARK);
  return true;
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
  mapsTo: string | undefined;
  required: boolean;
  /** Every format rule the value must match, whatever its origin: the `fieldType`, the native slot or the serving payload. */
  regexes?: readonly string[];
  /** `texts` key of the serving payload's own error message. It comes before every reserved key. */
  errorTextId?: string;
  maxLength?: number;
  /** Minimum accepted value length. Like the regex check, it applies only to non-empty values. */
  minLength?: number;
  /** Type-specific "invalid" `texts` key for email and phone. It comes before the generic invalid key. */
  invalidTextKey?: string;
  control: HTMLElement;
  element: HTMLElement;
  errorNode: HTMLElement;
  errorClass: string;
  getValue: () => FormFieldValue | null;
  /** Source text the string cascade validates when `getValue` returns a typed value. */
  validatedText?: () => string;
  /** Type-level acceptance of the trimmed text, checked after the regexes with the same invalid message. */
  accepts?: (text: string) => boolean;
  /** Replaces the string cascade for a component whose value is not a string. */
  validate?: (resolveError: (fallbackKeys: string[], fallback: string) => string) => string | null;
  /** Resolved on every focus: the control worth focusing can change once the form is rendered. */
  focusTarget?: () => HTMLElement;
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
    regexes,
    errorTextId,
    maxLength,
    minLength,
    invalidTextKey,
    control,
    element,
    errorNode,
    errorClass,
    getValue,
    validatedText,
    accepts,
    validate,
    focusTarget = () => control,
  } = options;

  const resolveError = (fallbackKeys: string[], fallback: string): string => {
    const candidates = [errorTextId ? message.texts[errorTextId] : undefined, ...fallbackKeys.map(key => message.texts[key])];
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
      if (validate !== undefined) {
        return validate(resolveError);
      }
      // Validate the trimmed value: the controller trims before collecting.
      const raw = getValue();
      const text = validatedText !== undefined ? validatedText() : raw?.type === ProfileAttributeType.STRING ? raw.value : "";
      const value = text.trim();
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
        for (const source of regexes ?? []) {
          const compiled = compileRegex(source);
          if (compiled && !compiled.test(value)) {
            return resolveError(invalidKeys, DEFAULT_INVALID_MESSAGE);
          }
        }
        // The kind is the authority on its own type: a pattern alone cannot say what `new URL` parses.
        if (accepts !== undefined && !accepts(value)) {
          return resolveError(invalidKeys, DEFAULT_INVALID_MESSAGE);
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
      const target = focusTarget();
      target.focus();
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center" });
      }
    },
    signalInvalid(): void {
      const target = (element.closest(".iam-field") as HTMLElement | null) ?? element;
      target.classList.remove("iam-field-shake");
      // Force a reflow so the animation restarts on every rejected submit.
      void target.offsetWidth;
      target.classList.add("iam-field-shake");
    },
  };

  controller.register(handle);
}
