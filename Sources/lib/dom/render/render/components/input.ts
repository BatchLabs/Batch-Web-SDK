import type { MessageBorderStyle, MessageInputModel, MessageModel } from "com.batch.dom/render/model/model";
import { RENDER_LOG_MODULE, RENDER_MAPS_TO_EMAIL_ADDRESS } from "com.batch.dom/render/render-constants";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";

import { applyBorderBoxStyles, applyTextElementStyles, createElement } from "../component-helpers";
import { applyResponsiveBox, applyResponsiveLength, applyThemePair, isTransparentColor, setResponsivePair } from "../dom-utils";
import type { FormRenderContext } from "../form-setup";
import { applyFlexItemWidth } from "../style-utils";
import { createErrorNode, createFieldWrapper, registerField } from "./field-helpers";
import { getInputDescriptor, MessageInputDescriptor } from "./input-types";

export function renderInput(component: MessageInputModel, message: MessageModel, context: FormRenderContext): HTMLElement {
  const form = context.form;

  const conf = component.configuration;
  const descriptor = getInputDescriptor(conf.inputType);
  const wrapper = createFieldWrapper("input");
  applyResponsiveBox(wrapper, "iam-margin", conf.placement.margin, conf.placement.marginDesktop);
  applyFlexItemWidth(wrapper, { percent: conf.width }, conf.align);

  const domId = `${component.id}-${context.domScope}`;

  const labelText = conf.labelTextId ? message.texts[conf.labelTextId] : undefined;
  const placeholderText = conf.placeholderId ? message.texts[conf.placeholderId] : undefined;
  // Hidden, the label stays in the DOM for the `for`/`id` link.
  const visibleLabelText = labelText && conf.labelVisible ? labelText : undefined;

  if (labelText) {
    const label = createElement("label", "iam-field-label");
    label.htmlFor = domId;
    label.textContent = labelText;
    if (visibleLabelText !== undefined) {
      // A shown label and its field expose the same explicit name.
      label.setAttribute("aria-label", visibleLabelText);
      if (component.required) {
        // The star is `aria-hidden`: `aria-required` on the control carries the semantics.
        const marker = createElement("span", "iam-field-label-required");
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = "*";
        label.append(marker);
      }
    } else {
      label.classList.add("iam-field-label--hidden");
    }
    applyThemePair(label, "iam-label-color", conf.labelColor, "inherit");
    applyResponsiveLength(label, "iam-label-font-size", conf.labelFontSize, conf.labelFontSizeDesktop);
    wrapper.appendChild(label);
  }

  const control = createElement("input", "iam-input");
  control.id = domId;
  control.name = component.id;
  applyInputSemantics(control, descriptor);
  const maxLength = resolveMaxLength(component, descriptor);
  control.maxLength = maxLength;

  const placeholder =
    component.required && visibleLabelText === undefined ? (placeholderText ? `${placeholderText} *` : "*") : placeholderText;
  if (placeholder) {
    control.placeholder = placeholder;
  }
  control.setAttribute("aria-label", visibleLabelText ?? placeholderText ?? component.id);
  if (conf.placeholderColor) {
    applyThemePair(control, "iam-placeholder-color", conf.placeholderColor);
    // Opacity 1: the 0.6 default only applies to a placeholder that inherits the text color.
    control.style.setProperty("--iam-placeholder-opacity", "1");
  }

  applyBorderBoxStyles(control, { style: conf.style });
  applyFocusRing(control, conf.style);
  applyTextElementStyles(control, { style: conf.style, fontStyle: conf.fontStyle });
  // A CSS variable, so the stylesheet can raise it to the 16px floor that prevents the iOS Safari autozoom.
  setResponsivePair(
    control,
    "iam-input-font-size",
    `${conf.fontStyle.fontSize}px`,
    conf.fontStyle.fontSizeDesktop !== undefined ? `${conf.fontStyle.fontSizeDesktop}px` : undefined
  );
  applyResponsiveBox(control, "iam-padding", conf.placement.padding, conf.placement.paddingDesktop);
  control.style.width = "100%";

  const errorNode = createErrorNode(domId);
  wrapper.appendChild(control);
  wrapper.appendChild(errorNode);

  registerField({
    controller: form,
    message,
    id: component.id,
    mapsTo: component.mapsTo,
    required: component.required,
    validation: component.validation,
    nativeRegexes: resolveNativeRegexes(component, descriptor),
    maxLength,
    minLength: resolveMinLength(component, maxLength),
    invalidTextKey: descriptor.invalidTextKey,
    control,
    element: wrapper,
    errorNode,
    errorClass: "iam-input--error",
    getValue: () => control.value,
  });

  control.addEventListener("input", () => form.handleInput(component.id));
  control.addEventListener("blur", () => form.handleBlur(component.id));
  // No native <form>: Enter clicks the submit button, so both activations share one path.
  control.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      context.submitButtonEl?.click();
    }
  });

  return wrapper;
}

function applyInputSemantics(control: HTMLInputElement, descriptor: MessageInputDescriptor): void {
  control.type = descriptor.htmlType;
  if (descriptor.inputMode) {
    control.setAttribute("inputmode", descriptor.inputMode);
  }
  if (descriptor.autocomplete) {
    control.setAttribute("autocomplete", descriptor.autocomplete);
  }
  if (descriptor.autocapitalize) {
    control.setAttribute("autocapitalize", descriptor.autocapitalize);
  }
  if (descriptor.autocorrect) {
    control.setAttribute("autocorrect", descriptor.autocorrect);
  }
  if (descriptor.spellcheck !== undefined) {
    // Content attribute, not the IDL property: jsdom implements neither the property nor its reflection.
    control.setAttribute("spellcheck", String(descriptor.spellcheck));
  }
  control.setAttribute("enterkeyhint", descriptor.enterKeyHint);
}

/** The veil that darkens the focus ring, per theme. Dark mode lightens instead. */
const FOCUS_VEIL_LIGHT = "rgba(0, 0, 0, 0.32)";
const FOCUS_VEIL_DARK = "rgba(255, 255, 255, 0.32)";

function applyFocusRing(control: HTMLElement, style: MessageBorderStyle): void {
  const [light, dark = light] = style.borderColor;
  if (style.borderWidth <= 0 || isTransparentColor(light) || isTransparentColor(dark)) {
    return;
  }

  control.classList.add("iam-input--focus-ring");
  control.style.setProperty("--iam-focus-veil", FOCUS_VEIL_LIGHT);
  control.style.setProperty("--iam-focus-veil-dark", FOCUS_VEIL_DARK);
}

function resolveNativeRegexes(component: MessageInputModel, descriptor: MessageInputDescriptor): readonly string[] | undefined {
  const sources: string[] = [];
  if (descriptor.nativeRegex) {
    sources.push(descriptor.nativeRegex);
  }
  if (component.mapsTo === RENDER_MAPS_TO_EMAIL_ADDRESS && !sources.includes(Consts.EmailAddressRegexp.source)) {
    sources.push(Consts.EmailAddressRegexp.source);
  }
  return sources.length > 0 ? sources : undefined;
}

function resolveMaxLength(component: MessageInputModel, descriptor: MessageInputDescriptor): number {
  const targetMaxLength =
    component.mapsTo === RENDER_MAPS_TO_EMAIL_ADDRESS ? Consts.EmailAddressMaxLength : Consts.AttributeStringMaxLengthCEP;
  const nativeMaxLength = Math.min(descriptor.nativeMaxLength, targetMaxLength);
  const servingMaxLength = component.configuration.maxLength;
  return servingMaxLength !== undefined ? Math.min(nativeMaxLength, servingMaxLength) : nativeMaxLength;
}

function resolveMinLength(component: MessageInputModel, maxLength: number): number | undefined {
  const servingMinLength = component.configuration.minLength;
  if (servingMinLength !== undefined && servingMinLength > maxLength) {
    Log.warn(
      RENDER_LOG_MODULE,
      `[form] field "${component.id}": minimum length ${servingMinLength} exceeds the effective maximum ${maxLength}, minimum ignored`
    );
    return undefined;
  }
  return servingMinLength;
}
