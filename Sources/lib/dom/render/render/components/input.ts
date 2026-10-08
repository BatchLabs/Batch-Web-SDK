import { ATTRIBUTE_KINDS, type MessageInputAttributeType } from "com.batch.dom/render/model/attribute-kinds";
import type { MessageInputModel, MessageModel } from "com.batch.dom/render/model/model";
import { RENDER_LOG_MODULE, RENDER_MAPS_TO_EMAIL_ADDRESS, RENDER_MAPS_TO_PHONE_NUMBER } from "com.batch.dom/render/render-constants";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { applyBorderBoxStyles, applyTextElementStyles, createElement } from "../component-helpers";
import { applyResponsiveBox, applyThemePair, setResponsivePair } from "../dom-utils";
import type { FormRenderContext } from "../form-setup";
import { applyFlexItemWidth } from "../style-utils";
import { applyFocusVeil, createErrorNode, createFieldWrapper, registerField, renderFieldLabel } from "./field-helpers";
import { getInputDescriptor, MessageInputDescriptor } from "./input-types";

/** Format each native slot holds its value to, whatever the `fieldType`: the submit drops what it refuses. */
const NATIVE_SLOT_REGEXES: Readonly<Partial<Record<string, RegExp>>> = {
  [RENDER_MAPS_TO_EMAIL_ADDRESS]: Consts.EmailAddressRegexp,
  [RENDER_MAPS_TO_PHONE_NUMBER]: Consts.PhoneNumberRegexp,
};

/** An entry the kind refuses carries nothing: the cascade already refuses it, and a bogus typed value must never ship. */
function inputValueOf(attributeType: MessageInputAttributeType, text: string): FormFieldValue | null {
  if (attributeType === ProfileAttributeType.STRING) {
    return { type: ProfileAttributeType.STRING, value: text };
  }
  return ATTRIBUTE_KINDS[attributeType].parse(text.trim());
}

/** A decimal keyboard in a comma locale (iOS in French) has no `.` key, so a float reads a comma as its separator when no dot is typed. */
function entryText(attributeType: MessageInputAttributeType, text: string): string {
  return attributeType === ProfileAttributeType.FLOAT && !text.includes(".") ? text.replace(",", ".") : text;
}

export function renderInput(component: MessageInputModel, message: MessageModel, context: FormRenderContext): HTMLElement {
  const form = context.form;

  const conf = component.configuration;
  const descriptor = getInputDescriptor(conf.inputType, conf.attributeType);
  const wrapper = createFieldWrapper("input");
  applyResponsiveBox(wrapper, "iam-margin", conf.placement.margin, conf.placement.marginDesktop);
  applyFlexItemWidth(wrapper, { percent: conf.width }, conf.align);

  const domId = `${component.id}-${context.domScope}`;

  const labelText = conf.labelTextId ? message.texts[conf.labelTextId] : undefined;
  const placeholderText = conf.placeholderId ? message.texts[conf.placeholderId] : undefined;
  // Hidden, the label stays in the DOM for the `for`/`id` link.
  const visibleLabelText = labelText && conf.labelVisible ? labelText : undefined;

  if (labelText) {
    wrapper.appendChild(
      renderFieldLabel({
        tag: "label",
        htmlFor: domId,
        text: labelText,
        required: component.required,
        label: conf,
      })
    );
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
  if (component.required) {
    control.setAttribute("aria-required", "true");
  }
  if (conf.placeholderColor) {
    applyThemePair(control, "iam-placeholder-color", conf.placeholderColor);
    // Opacity 1: the 0.6 default only applies to a placeholder that inherits the text color.
    control.style.setProperty("--iam-placeholder-opacity", "1");
  }

  applyBorderBoxStyles(control, { style: conf.style });
  if (applyFocusVeil(control, conf.style)) {
    control.classList.add("iam-input--focus-ring");
  }
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
    regexes: resolveRegexes(component, descriptor),
    errorTextId: component.validation?.errorId,
    maxLength,
    minLength: resolveMinLength(component, maxLength),
    invalidTextKey: descriptor.invalidTextKey,
    control,
    element: wrapper,
    errorNode,
    errorClass: "iam-input--error",
    getValue: () => inputValueOf(conf.attributeType, entryText(conf.attributeType, control.value)),
    validatedText: () => entryText(conf.attributeType, control.value),
    // A string goes through its kind too: the native maxLength counts characters, the server bytes.
    accepts: (text: string) => ATTRIBUTE_KINDS[conf.attributeType].parse(text) !== null,
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

/** A payload regex adds to the native rules and never replaces them: the value must match each one. */
function resolveRegexes(component: MessageInputModel, descriptor: MessageInputDescriptor): readonly string[] {
  const candidates = [descriptor.nativeRegex, NATIVE_SLOT_REGEXES[component.mapsTo]?.source, component.validation?.regex];
  const sources: string[] = [];
  for (const source of candidates) {
    if (source && !sources.includes(source)) {
      sources.push(source);
    }
  }
  return sources;
}

function resolveMaxLength(component: MessageInputModel, descriptor: MessageInputDescriptor): number {
  // The descriptor already carries the bound of its own type; only the native email slot lowers it further.
  const nativeMaxLength =
    component.mapsTo === RENDER_MAPS_TO_EMAIL_ADDRESS
      ? Math.min(descriptor.nativeMaxLength, Consts.EmailAddressMaxLength)
      : descriptor.nativeMaxLength;
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
