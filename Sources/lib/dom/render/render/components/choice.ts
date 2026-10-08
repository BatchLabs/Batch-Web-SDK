import { ATTRIBUTE_KINDS } from "com.batch.dom/render/model/attribute-kinds";
import type { MessageChoiceModel, MessageChoiceValueModel, MessageModel } from "com.batch.dom/render/model/model";
import { MessageChoiceLayoutValue, MessageChoiceTypeValue } from "com.batch.dom/render/model/types";
import { RENDER_TEXT_KEY_FORM_INVALID_ERROR, RENDER_TEXT_KEY_FORM_REQUIRED_ERROR } from "com.batch.dom/render/render-constants";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { PartialUpdateObject, ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { createElement } from "../component-helpers";
import { applyResponsiveBox, applyResponsiveLength, applyThemePair, setResponsivePair } from "../dom-utils";
import type { FormRenderContext } from "../form-setup";
import { resolveAlignSelf } from "../style-utils";
import { applyFocusVeil, createErrorNode, createFieldWrapper, registerField, renderFieldLabel } from "./field-helpers";

/** Duplicates the stylesheet's box border width: the focus veil only draws over a visible border. */
export const CHOICE_BOX_BORDER_WIDTH = 1;

interface ChoiceOption {
  model: MessageChoiceValueModel;
  item: HTMLElement;
  input: HTMLInputElement;
}

function renderOption(
  option: MessageChoiceValueModel,
  component: MessageChoiceModel,
  message: MessageModel,
  domScope: string
): ChoiceOption {
  const conf = component.configuration;
  const item = createElement("label", "iam-choice-item");

  const input = createElement("input", "iam-choice-input");
  input.type = conf.choiceType;
  // One name per group: the browser then enforces the exclusivity of a radio for us.
  input.name = component.id;
  input.id = `${component.id}-${option.id}-${domScope}`;
  input.value = option.attributeValue;
  input.checked = option.selected;

  // The box is decoration: the native control it follows carries the state and the accessible name.
  const box = createElement("span", "iam-choice-box");
  box.setAttribute("aria-hidden", "true");

  const text = createElement("span", "iam-choice-text");
  text.textContent = message.texts[option.id] ?? option.attributeValue;

  item.append(input, box, text);
  return { model: option, item, input };
}

function collectValue(component: MessageChoiceModel, options: ChoiceOption[]): FormFieldValue | null {
  const conf = component.configuration;
  // A boolean checkbox stands alone: what it submits is whether it is checked, not what its option carries.
  if (conf.attributeType === ProfileAttributeType.BOOLEAN && conf.choiceType === MessageChoiceTypeValue.Checkbox) {
    return { type: ProfileAttributeType.BOOLEAN, value: options[0].input.checked };
  }
  if (conf.attributeType !== ProfileAttributeType.ARRAY) {
    // The normalizer dropped every option the kind refuses, so the conversion cannot fail here.
    const selected = options.find(option => option.input.checked);
    return selected !== undefined ? ATTRIBUTE_KINDS[conf.attributeType].parse(selected.model.attributeValue) : null;
  }
  // Both branches follow the payload order, never the click order: the submit fingerprint depends on it.
  const add = options.filter(option => option.input.checked).map(option => option.model.attributeValue);
  const remove = options.filter(option => !option.input.checked).map(option => option.model.attributeValue);
  const update: PartialUpdateObject = {};
  if (add.length > 0) {
    update.$add = add;
  }
  if (remove.length > 0) {
    update.$remove = remove;
  }
  return { type: ProfileAttributeType.ARRAY, value: update };
}

/** A group at its maximum disables what is not checked, so the ceiling is read on the controls instead of on a submit error. */
function enforceMaximum(component: MessageChoiceModel, options: ChoiceOption[]): void {
  const maxSelected = component.configuration.maxSelected;
  if (maxSelected === undefined) {
    return;
  }
  const checked = options.filter(option => option.input.checked).length;
  for (const option of options) {
    option.input.disabled = !option.input.checked && checked >= maxSelected;
  }
}

export function renderChoice(component: MessageChoiceModel, message: MessageModel, context: FormRenderContext): HTMLElement {
  const form = context.form;
  const conf = component.configuration;
  const isGroup = conf.values.length >= 2;

  const wrapper = createFieldWrapper("choice", isGroup ? "fieldset" : "div");
  applyResponsiveBox(wrapper, "iam-margin", conf.placement.margin, conf.placement.marginDesktop);

  const list = createElement("div", "iam-choice-list");
  if (conf.layout === MessageChoiceLayoutValue.Horizontal) {
    list.classList.add("iam-choice-list--horizontal");
  }
  // The stylesheet reads it as the cross axis of a stacked list and as the main axis of a horizontal one.
  list.style.setProperty("--iam-choice-align", resolveAlignSelf(conf.align));
  setResponsivePair(list, "iam-choice-spacing", `${conf.spacing}px`);
  applyThemePair(list, "iam-color", conf.textColor, "inherit");
  applyResponsiveLength(list, "iam-font-size", conf.fontStyle.fontSize, conf.fontStyle.fontSizeDesktop);
  applyThemePair(list, "iam-border-color", conf.borderColor, "transparent");
  applyThemePair(list, "iam-choice-checked-color", conf.checkedColor, "currentColor");
  // Without a visible border there is no ring to thicken, and the native control is invisible: the box takes an outline instead.
  if (!applyFocusVeil(list, { borderColor: conf.borderColor, borderWidth: CHOICE_BOX_BORDER_WIDTH })) {
    list.classList.add("iam-choice-list--outline");
  }

  const domId = `${component.id}-${context.domScope}`;
  const options = conf.values.map(value => renderOption(value, component, message, context.domScope));
  const labelText = conf.labelTextId ? message.texts[conf.labelTextId] : undefined;

  if (labelText) {
    wrapper.appendChild(
      renderFieldLabel({
        tag: isGroup ? "legend" : "label",
        htmlFor: isGroup ? undefined : options[0].input.id,
        text: labelText,
        required: component.required,
        label: conf,
      })
    );
  }

  for (const option of options) {
    list.appendChild(option.item);
  }
  const errorNode = createErrorNode(domId);
  wrapper.append(list, errorNode);

  const isRadioGroup = isGroup && conf.choiceType === MessageChoiceTypeValue.Radio;
  const control = isGroup ? wrapper : options[0].input;
  if (isRadioGroup) {
    wrapper.setAttribute("role", "radiogroup");
  }
  // A plain group role takes no `aria-required`: a checkbox group relies on its star and on the error it links.
  if (component.required && (!isGroup || isRadioGroup)) {
    control.setAttribute("aria-required", "true");
  }

  registerField({
    controller: form,
    message,
    id: component.id,
    mapsTo: component.mapsTo,
    required: component.required,
    control,
    // The maximum can disable the first option but never a checked one, so the focus goes to the first option still enabled.
    focusTarget: () => (options.find(option => !option.input.disabled) ?? options[0]).input,
    element: wrapper,
    errorNode,
    errorClass: "iam-choice--error",
    getValue: () => collectValue(component, options),
    validate: resolveError => validateSelection(component, options, resolveError),
  });

  enforceMaximum(component, options);
  for (const option of options) {
    // `handleInput` only refreshes an error already shown: a partial selection must not fail the group while the user is still choosing.
    option.input.addEventListener("change", () => {
      enforceMaximum(component, options);
      form.handleInput(component.id);
    });
  }

  return wrapper;
}

/** `minSelected` above 1 reads as an invalid value, not as a missing one. */
function validateSelection(
  component: MessageChoiceModel,
  options: ChoiceOption[],
  resolveError: (fallbackKeys: string[], fallback: string) => string
): string | null {
  const conf = component.configuration;
  const required = (): string => resolveError([RENDER_TEXT_KEY_FORM_REQUIRED_ERROR], "This field is required.");
  const invalid = (): string => resolveError([RENDER_TEXT_KEY_FORM_INVALID_ERROR], "This value is invalid.");

  if (conf.attributeType !== ProfileAttributeType.ARRAY) {
    return component.required && !options.some(option => option.input.checked) ? required() : null;
  }

  const checked = options.filter(option => option.input.checked).length;
  const minimum = Math.max(component.required ? 1 : 0, conf.minSelected ?? 0);
  if (checked < minimum) {
    return minimum === 1 ? required() : invalid();
  }
  return conf.maxSelected !== undefined && checked > conf.maxSelected ? invalid() : null;
}
