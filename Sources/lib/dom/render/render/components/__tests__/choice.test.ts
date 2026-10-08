/* eslint-env jest */

import type { MessageChoiceModel, MessageModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { RENDER_TEXT_KEY_FORM_INVALID_ERROR, RENDER_TEXT_KEY_FORM_REQUIRED_ERROR } from "com.batch.dom/render/render-constants";
import { renderChoice } from "com.batch.dom/render/render/components/choice";
import type { FormRenderContext } from "com.batch.dom/render/render/form-setup";
import { MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import {
  ATTRIBUTE_TYPE_CASES,
  RADIO_OPTIONS,
  SCALAR_ATTRIBUTE_TYPES,
} from "com.batch.dom/render/test-utils/factories/attribute-type-cases";
import { componentMessage, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

const SUBMIT_ID = "c:submit";
const DOM_SCOPE = "s1";

const TEXTS = {
  sports_label: "Favourite sports",
  tennis_label: "Tennis",
  golf_label: "Golf",
  padel_label: "Padel",
};

const VALUES = [
  { id: "tennis_label", attributeValue: "tennis" },
  { id: "golf_label", attributeValue: "golf" },
  { id: "padel_label", attributeValue: "padel" },
];

const NUMERIC_VALUES = [
  { id: "one", attributeValue: "1" },
  { id: "two", attributeValue: "2" },
];

const BOOLEAN_VALUES = [
  { id: "one", attributeValue: "true" },
  { id: "two", attributeValue: "false" },
];

interface Rendered {
  element: HTMLElement;
  form: MessageFormController;
  inputs: HTMLInputElement[];
}

interface Normalized {
  message: MessageModel;
  model: MessageChoiceModel;
}

function normalize(patch: Record<string, unknown>, texts: Record<string, string> = TEXTS): Normalized {
  const message: MessageModel = normalizeMessage(
    componentMessage({ type: "choice", id: "sports", mapsTo: "sports", labelTextId: "sports_label", ...patch }, { texts })
  );
  return { message, model: selectFirstChild<MessageChoiceModel>(message, "choice") };
}

function mount({ message, model }: Normalized, domScope: string = DOM_SCOPE): Rendered {
  const form = new MessageFormController(
    message,
    SUBMIT_ID,
    { setSubmitting: jest.fn(), showFormMessage: jest.fn(), clearFormMessage: jest.fn(), complete: jest.fn() },
    jest.fn(() => Promise.resolve({ kind: "none" as const }))
  );
  const context: FormRenderContext = { form, domScope, submitId: SUBMIT_ID, submitButtonEl: null };
  const element = renderChoice(model, message, context);
  document.body.replaceChildren(element);
  return { element, form, inputs: Array.from(element.querySelectorAll<HTMLInputElement>(".iam-choice-input")) };
}

function render(patch: Record<string, unknown>, texts: Record<string, string> = TEXTS): Rendered {
  return mount(normalize(patch, texts));
}

const checkboxGroup = (patch: Record<string, unknown> = {}): Rendered =>
  render({ choiceType: "checkbox", attributeType: "array", values: VALUES, ...patch });

const radioGroup = (patch: Record<string, unknown> = {}): Rendered =>
  render({ choiceType: "radio", attributeType: "string", values: VALUES, ...patch });

const booleanChoice = (patch: Record<string, unknown> = {}): Rendered =>
  render({ choiceType: "checkbox", attributeType: "boolean", values: [VALUES[0]], ...patch });

const check = (input: HTMLInputElement): void => {
  input.checked = true;
  input.dispatchEvent(new Event("change"));
};

describe("choice DOM", () => {
  test("a group is a fieldset named by its legend, with one control per option", () => {
    const { element, inputs } = checkboxGroup();

    expect(element.tagName).toBe("FIELDSET");
    expect(element.className).toBe("iam-field iam-field-choice");
    expect(element.querySelector("legend.iam-field-label")?.textContent).toBe("Favourite sports");
    expect(inputs.map(input => [input.type, input.name, input.id, input.value])).toEqual([
      ["checkbox", "sports", `sports-tennis_label-${DOM_SCOPE}`, "tennis"],
      ["checkbox", "sports", `sports-golf_label-${DOM_SCOPE}`, "golf"],
      ["checkbox", "sports", `sports-padel_label-${DOM_SCOPE}`, "padel"],
    ]);
    expect(Array.from(element.querySelectorAll(".iam-choice-text")).map(node => node.textContent)).toEqual(["Tennis", "Golf", "Padel"]);
  });

  test("an option is a label wrapping the control, a decorative box hidden from assistive tech, and its text", () => {
    const { inputs } = checkboxGroup();
    const item = inputs[0].parentElement as HTMLElement;
    const box = inputs[0].nextElementSibling as HTMLElement;
    const text = box.nextElementSibling as HTMLElement;

    expect([item.tagName, item.className]).toEqual(["LABEL", "iam-choice-item"]);
    expect([box.tagName, box.className, box.getAttribute("aria-hidden")]).toEqual(["SPAN", "iam-choice-box", "true"]);
    expect([text.tagName, text.className, text.textContent]).toEqual(["SPAN", "iam-choice-text", "Tennis"]);
    expect(item.children).toHaveLength(3);
  });

  test("a single box is a plain wrapper whose label points at the control", () => {
    const { element, inputs } = booleanChoice();

    expect(element.tagName).toBe("DIV");
    const label = element.querySelector<HTMLLabelElement>("label.iam-field-label");
    expect(label?.htmlFor).toBe(inputs[0].id);
  });

  test("a radio group renders radios the browser keeps exclusive", () => {
    const values = VALUES.map((value, i) => Object.assign({}, value, { selected: i === 1 }));
    const { inputs } = radioGroup({ values });

    expect(inputs.map(input => input.type)).toEqual(["radio", "radio", "radio"]);
    expect(inputs.map(input => input.checked)).toEqual([false, true, false]);
  });

  test("a hidden label names the control through the DOM link, never through an aria-label that would hide the option text", () => {
    const single = booleanChoice({ labelVisible: false });
    const label = single.element.querySelector<HTMLLabelElement>("label.iam-field-label");
    expect(label?.classList.contains("iam-field-label--hidden")).toBe(true);
    expect(label?.htmlFor).toBe(single.inputs[0].id);
    expect(single.inputs[0].hasAttribute("aria-label")).toBe(false);

    const group = checkboxGroup({ labelVisible: false });
    expect(group.element.querySelector("legend.iam-field-label--hidden")?.textContent).toBe("Favourite sports");
    expect(group.element.hasAttribute("aria-label")).toBe(false);
  });

  test("a transparent box border hands the focus to an outline, since the veil would thicken no visible ring", () => {
    const outlined = (borderColor?: string[]): boolean | undefined =>
      checkboxGroup(borderColor ? { borderColor } : {})
        .element.querySelector(".iam-choice-list")
        ?.classList.contains("iam-choice-list--outline");

    expect(outlined(["#00000000"])).toBe(true);
    expect(outlined(["#000000", "#00000000"])).toBe(true);
    expect(outlined()).toBe(false);
  });

  test("two renders of the same payload never share an option id", () => {
    const normalized = normalize({ choiceType: "checkbox", attributeType: "array", values: VALUES });
    const first = mount(normalized, "s1").inputs.map(input => input.id);
    const second = new Set(mount(normalized, "s2").inputs.map(input => input.id));

    expect(first).toHaveLength(VALUES.length);
    expect(first.filter(id => second.has(id))).toEqual([]);
  });
});

describe("choice submitted value", () => {
  test("a boolean choice always reports its state", () => {
    const { form, inputs } = booleanChoice({ mapsTo: "newsletter" });

    expect(form.collectAttributes()).toEqual({ newsletter: { type: ProfileAttributeType.BOOLEAN, value: false } });
    check(inputs[0]);
    expect(form.collectAttributes()).toEqual({ newsletter: { type: ProfileAttributeType.BOOLEAN, value: true } });
  });

  test("a radio choice reports the value of the selected option, and nothing until one is", () => {
    const { form, inputs } = radioGroup();

    expect(form.collectAttributes()).toEqual({});
    check(inputs[2]);
    expect(form.collectAttributes()).toEqual({ sports: { type: ProfileAttributeType.STRING, value: "padel" } });
  });

  test("a checkbox group reports a partial update in payload order, whatever the click order", () => {
    const { form, inputs } = checkboxGroup();

    check(inputs[2]);
    check(inputs[0]);

    expect(form.collectAttributes()).toEqual({
      sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["tennis", "padel"], $remove: ["golf"] } },
    });
  });

  test("a checkbox group with nothing checked removes every option it owns", () => {
    const { form } = checkboxGroup();

    expect(form.collectAttributes()).toEqual({
      sports: { type: ProfileAttributeType.ARRAY, value: { $remove: ["tennis", "golf", "padel"] } },
    });
  });

  test("a checkbox group with everything checked adds without removing", () => {
    const { form, inputs } = checkboxGroup();

    for (const input of inputs) {
      check(input);
    }

    expect(form.collectAttributes()).toEqual({
      sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["tennis", "golf", "padel"] } },
    });
  });

  test("a choice without a profile target is never collected", () => {
    const { form, inputs } = checkboxGroup({ mapsTo: undefined });

    check(inputs[0]);
    expect(form.collectAttributes()).toEqual({});
  });

  test("a radio typed float keeps an integral option a float, which no inference could tell", () => {
    const { form, inputs } = radioGroup({ attributeType: "float", values: NUMERIC_VALUES });

    check(inputs[1]);
    expect(form.collectAttributes()).toEqual({ sports: { type: ProfileAttributeType.FLOAT, value: 2 } });
  });

  test("a radio typed boolean reads the option the user checked, never the first one", () => {
    const { form, inputs } = radioGroup({ attributeType: "boolean", values: [BOOLEAN_VALUES[1], BOOLEAN_VALUES[0]] });

    check(inputs[1]);
    expect(form.collectAttributes()).toEqual({ sports: { type: ProfileAttributeType.BOOLEAN, value: true } });
  });

  test.each(SCALAR_ATTRIBUTE_TYPES)("a %s radio submits the value the table promises", type => {
    const { form, inputs } = radioGroup({ attributeType: type, values: RADIO_OPTIONS[type] });

    check(inputs[0]);
    expect(form.collectAttributes()).toEqual({ sports: ATTRIBUTE_TYPE_CASES[type].accepted[0].value });
  });

  test("a lone array option writes a one-member partial update both ways", () => {
    const { form, inputs } = render({ choiceType: "checkbox", attributeType: "array", values: [VALUES[0]] });

    expect(form.collectAttributes()).toEqual({ sports: { type: ProfileAttributeType.ARRAY, value: { $remove: ["tennis"] } } });

    check(inputs[0]);
    expect(form.collectAttributes()).toEqual({ sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["tennis"] } } });
  });
});

describe("choice validation", () => {
  test("a required boolean choice blocks the submit until it is checked", () => {
    const { form, inputs, element } = booleanChoice({ required: true });

    expect(form.validateAll()).toBe(false);
    expect(element.querySelector(".iam-field-error")?.textContent).toBe("This field is required.");

    check(inputs[0]);
    expect(form.validateAll()).toBe(true);
  });

  test("a required scalar radio asks for one checked option, whatever the type it writes", () => {
    const { form, inputs, element } = radioGroup({ attributeType: "integer", required: true, values: NUMERIC_VALUES });

    expect(form.validateAll()).toBe(false);
    expect(element.querySelector(".iam-field-error")?.textContent).toBe("This field is required.");

    check(inputs[0]);
    expect(form.validateAll()).toBe(true);
  });

  test("a required radio group is satisfied by any option, not just the first", () => {
    const empty = radioGroup({ required: true });
    expect(empty.form.validateAll()).toBe(false);
    expect(empty.element.querySelector(".iam-field-error")?.textContent).toBe("This field is required.");

    const last = radioGroup({ required: true });
    check(last.inputs[last.inputs.length - 1]);
    expect(last.form.validateAll()).toBe(true);
    expect(last.element.querySelector(".iam-field-error")?.textContent).toBe("");

    // A boolean radio reads the group too: only a checkbox stands alone on its first control.
    const boolean = radioGroup({ attributeType: "boolean", required: true, values: BOOLEAN_VALUES });
    check(boolean.inputs[1]);
    expect(boolean.form.validateAll()).toBe(true);
    expect(boolean.element.querySelector(".iam-field-error")?.textContent).toBe("");
  });

  test("a required group asks for one option, and a minimum asks for more", () => {
    const one = checkboxGroup({ required: true });
    expect(one.form.validateAll()).toBe(false);
    expect(one.element.querySelector(".iam-field-error")?.textContent).toBe("This field is required.");
    check(one.inputs[0]);
    expect(one.form.validateAll()).toBe(true);

    const two = checkboxGroup({ minMax: [2, 0] });
    check(two.inputs[0]);
    expect(two.form.validateAll()).toBe(false);
    expect(two.element.querySelector(".iam-field-error")?.textContent).toBe("This value is invalid.");
    check(two.inputs[1]);
    expect(two.form.validateAll()).toBe(true);
  });

  test("an array group inside its bounds carries no error", () => {
    const { form, element, inputs } = checkboxGroup({ minMax: [1, 2] });

    check(inputs[0]);
    expect(form.validateAll()).toBe(true);
    expect(element.querySelector(".iam-field-error")?.textContent).toBe("");

    check(inputs[1]);
    check(inputs[2]);
    expect(form.validateAll()).toBe(false);
    expect(element.querySelector(".iam-field-error")?.textContent).toBe("This value is invalid.");
  });

  test("a group at its maximum disables the options left, and frees them again", () => {
    const { inputs } = checkboxGroup({ minMax: [0, 2] });

    check(inputs[0]);
    check(inputs[1]);
    expect(inputs.map(input => input.disabled)).toEqual([false, false, true]);

    inputs[1].checked = false;
    inputs[1].dispatchEvent(new Event("change"));
    expect(inputs.map(input => input.disabled)).toEqual([false, false, false]);
  });

  test("a selection above the maximum is rejected, even when the payload arrives pre-checked past it", () => {
    const { form, element } = render({
      choiceType: "checkbox",
      attributeType: "array",
      minMax: [0, 1],
      values: VALUES.map(value => Object.assign({}, value, { selected: true })),
    });

    expect(form.validateAll()).toBe(false);
    expect(element.querySelector(".iam-field-error")?.textContent).toBe("This value is invalid.");
  });

  test("choosing an option never raises an error, and clears one already shown", () => {
    const { form, element, inputs } = checkboxGroup({ minMax: [2, 0] });
    const error = element.querySelector(".iam-field-error") as HTMLElement;

    check(inputs[0]);
    expect(error.classList.contains("iam-field-error--visible")).toBe(false);
    expect(element.getAttribute("aria-invalid")).toBeNull();

    expect(form.validateAll()).toBe(false);
    expect(error.textContent).toBe("This value is invalid.");
    expect(error.classList.contains("iam-field-error--visible")).toBe(true);

    check(inputs[1]);
    expect(error.classList.contains("iam-field-error--visible")).toBe(false);
    expect(element.getAttribute("aria-invalid")).toBeNull();
  });

  test("a rejected group takes the focus on its first control, never on the fieldset", () => {
    const { form, element, inputs } = checkboxGroup({ required: true });

    expect(form.validateAll()).toBe(false);

    expect(element.getAttribute("aria-invalid")).toBe("true");
    expect(element.getAttribute("aria-describedby")).toBe(`sports-${DOM_SCOPE}-error`);
    expect(element.classList.contains("iam-choice--error")).toBe(true);
    expect(document.activeElement).toBe(inputs[0]);
  });

  test("a group over its maximum takes the focus on a control the maximum left enabled", () => {
    const values = VALUES.map((value, i) => Object.assign({}, value, { selected: i > 0 }));
    const { form, inputs } = checkboxGroup({ values, minMax: [0, 1] });
    expect(inputs[0].disabled).toBe(true);

    expect(form.validateAll()).toBe(false);

    expect(document.activeElement).toBe(inputs[1]);
  });
  test("an optional group never blocks the submit", () => {
    const { form } = checkboxGroup();

    expect(form.validateAll()).toBe(true);
  });

  test("a lone box carries its own error state, the wrapper stays clean", () => {
    const { form, element, inputs } = booleanChoice({ required: true });

    expect(form.validateAll()).toBe(false);

    const error = element.querySelector(".iam-field-error") as HTMLElement;
    expect(inputs[0].classList.contains("iam-choice--error")).toBe(true);
    expect(inputs[0].getAttribute("aria-invalid")).toBe("true");
    expect(inputs[0].getAttribute("aria-describedby")).toBe(error.id);
    expect(element.classList.contains("iam-choice--error")).toBe(false);
    expect(element.getAttribute("aria-invalid")).toBeNull();
    expect(element.getAttribute("aria-describedby")).toBeNull();
    expect(element.getAttribute("aria-required")).toBeNull();
  });

  test("without a maximum no option is ever disabled", () => {
    const { inputs } = checkboxGroup();

    for (const input of inputs) {
      check(input);
    }

    expect(inputs.map(input => input.disabled)).toEqual([false, false, false]);
  });

  test("the minimum wins over the maximum when both are broken", () => {
    // The normalizer refuses a minimum above the maximum, so the only way to reach the pair is to build the model.
    const normalized = normalize({ choiceType: "checkbox", attributeType: "array", values: VALUES });
    const broken: Normalized = {
      message: normalized.message,
      model: { ...normalized.model, configuration: { ...normalized.model.configuration, minSelected: 3, maxSelected: 2 } },
    };
    const { form, element, inputs } = mount(broken);

    check(inputs[0]);

    expect(form.validateAll()).toBe(false);
    expect(element.querySelector(".iam-field-error")?.textContent).toBe("This value is invalid.");
  });

  test("a choice has no errorId: a required group reads the reserved text, whatever the payload declared", () => {
    const { form, element } = render(
      { choiceType: "checkbox", attributeType: "array", values: VALUES, required: true, validation: { errorId: "custom" } },
      { ...TEXTS, custom: "Custom" }
    );

    expect(form.validateAll()).toBe(false);
    expect(element.querySelector(".iam-field-error")?.textContent).toBe("This field is required.");
  });

  test("the reserved error texts the payload declares win over the built-in English copy", () => {
    const texts = {
      ...TEXTS,
      [RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]: "Ce champ est obligatoire.",
      [RENDER_TEXT_KEY_FORM_INVALID_ERROR]: "Cette valeur est invalide.",
    };

    const required = render({ choiceType: "checkbox", attributeType: "array", values: VALUES, required: true }, texts);
    expect(required.form.validateAll()).toBe(false);
    expect(required.element.querySelector(".iam-field-error")?.textContent).toBe("Ce champ est obligatoire.");

    const above = render(
      {
        choiceType: "checkbox",
        attributeType: "array",
        minMax: [0, 1],
        values: VALUES.map(value => Object.assign({}, value, { selected: true })),
      },
      texts
    );
    expect(above.form.validateAll()).toBe(false);
    expect(above.element.querySelector(".iam-field-error")?.textContent).toBe("Cette valeur est invalide.");
  });
});
