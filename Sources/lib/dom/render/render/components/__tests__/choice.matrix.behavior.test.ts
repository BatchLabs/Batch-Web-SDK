/* eslint-env jest */

import type { MessageChoiceModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageChoicePayload, MessageChoiceValuePayload } from "com.batch.dom/render/model/types";
import { RADIO_OPTIONS } from "com.batch.dom/render/test-utils/factories/attribute-type-cases";
import {
  buildChoiceMessage,
  CHOICE_ID,
  CHOICE_VALUES,
  inputs,
  optionTexts,
} from "com.batch.dom/render/test-utils/factories/choice-payloads";
import type { AssertNever, ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { attributesOf, runComponentMatrix, selectFirstChild } from "com.batch.dom/render/test-utils/prop-matrix";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import type { styleProps } from "./choice.matrix.style.test";

const DOM_SCOPE_LESS = (id: string): string => id.replace(/-[^-]+$/, "");

type BehaviorProps = Pick<
  MessageChoicePayload,
  "mapsTo" | "choiceType" | "attributeType" | "values" | "required" | "minMax" | "labelTextId" | "labelVisible" | "hideOn" | "validation"
>;

export const behaviorProps: PropMatrix<BehaviorProps, MessageChoiceModel> = {
  mapsTo: {
    cssExpression: "none",
    cases: [
      {
        name: "declared → the profile target the submit keys on",
        expectModel: m => expect(m.mapsTo).toBe("sports"),
      },
      {
        name: "blank → no target at all, so the choice gates the submit without writing",
        patch: { mapsTo: "  " },
        expectModel: m => expect(m.mapsTo).toBeUndefined(),
      },
      {
        name: "topic preferences are the one `$`-prefixed native slot a choice writes",
        patch: { mapsTo: "$topic_preferences" },
        expectModel: m => expect(m.mapsTo).toBe("$topic_preferences"),
      },
    ],
  },
  choiceType: {
    cases: [
      {
        name: "checkbox → checkbox controls, carrying the array the payload declares",
        expectModel: m =>
          expect([m.configuration.choiceType, m.configuration.attributeType]).toEqual(["checkbox", ProfileAttributeType.ARRAY]),
        expectCss: el => expect(inputs(el).map(input => input.type)).toEqual(["checkbox", "checkbox"]),
      },
      {
        name: "radio → radio controls, carrying the scalar the payload declares",
        patch: { choiceType: "radio", attributeType: "string" },
        expectModel: m =>
          expect([m.configuration.choiceType, m.configuration.attributeType]).toEqual(["radio", ProfileAttributeType.STRING]),
        expectCss: el => expect(inputs(el).map(input => input.type)).toEqual(["radio", "radio"]),
      },
    ],
  },
  attributeType: {
    cases: [
      {
        name: "declared → carried as is, never re-derived from the control",
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.ARRAY),
        expectCss: el => expect(inputs(el).map(input => input.type)).toEqual(["checkbox", "checkbox"]),
      },
      {
        name: "missing → the type the control writes, so a payload predating the key still renders",
        patch: { attributeType: undefined },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.ARRAY),
        expectCss: el => expect(inputs(el).map(input => input.type)).toEqual(["checkbox", "checkbox"]),
      },
      {
        name: "radio + integer → a radio whose options carry the numbers it writes",
        patch: {
          choiceType: "radio",
          attributeType: "integer",
          values: [
            { id: "one", attributeValue: "1" },
            { id: "two", attributeValue: "2" },
          ],
        },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.INTEGER),
        expectCss: el =>
          expect(inputs(el).map(input => [input.type, input.value])).toEqual([
            ["radio", "1"],
            ["radio", "2"],
          ]),
      },
      {
        name: "radio + date → a radio whose options carry the instants it writes",
        patch: {
          choiceType: "radio",
          attributeType: "date",
          values: [
            { id: "one", attributeValue: "2026-01-01" },
            { id: "two", attributeValue: "2026-09-09" },
          ],
        },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.DATE),
        expectCss: el => expect(inputs(el).map(input => input.value)).toEqual(["2026-01-01", "2026-09-09"]),
      },
      {
        name: "radio + url → a radio whose options carry the URLs it writes",
        patch: {
          choiceType: "radio",
          attributeType: "url",
          values: [
            { id: "one", attributeValue: "https://batch.com/a" },
            { id: "two", attributeValue: "https://batch.com/b" },
          ],
        },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.URL),
        expectCss: el => expect(inputs(el).map(input => input.value)).toEqual(["https://batch.com/a", "https://batch.com/b"]),
      },
      {
        name: "radio + float → options carrying the decimals it writes",
        patch: { choiceType: "radio", attributeType: "float", values: RADIO_OPTIONS.float },
        expectModel: m =>
          expect([m.configuration.attributeType, m.configuration.values.map(value => value.attributeValue)]).toEqual([
            ProfileAttributeType.FLOAT,
            RADIO_OPTIONS.float.map(option => option.attributeValue),
          ]),
        expectCss: el =>
          expect(inputs(el).map(input => [input.type, input.value])).toEqual(
            RADIO_OPTIONS.float.map(option => ["radio", option.attributeValue])
          ),
      },
      {
        name: "radio + boolean → two options naming the two truths",
        patch: { choiceType: "radio", attributeType: "boolean", values: RADIO_OPTIONS.boolean },
        expectModel: m =>
          expect([m.configuration.attributeType, m.configuration.values.map(value => value.attributeValue)]).toEqual([
            ProfileAttributeType.BOOLEAN,
            ["true", "false"],
          ]),
        expectCss: el =>
          expect(inputs(el).map(input => [input.type, input.value])).toEqual([
            ["radio", "true"],
            ["radio", "false"],
          ]),
      },
      {
        name: "checkbox + boolean → a lone box whose value the checked state replaces",
        patch: { attributeType: "boolean", values: [CHOICE_VALUES[0]] },
        expectModel: m => expect(m.configuration.attributeType).toBe(ProfileAttributeType.BOOLEAN),
        expectCss: el => expect(inputs(el).map(input => input.type)).toEqual(["checkbox"]),
      },
    ],
  },
  values: {
    cases: [
      {
        name: "each option carries its two identities and its state",
        expectModel: m =>
          expect(m.configuration.values).toEqual([
            { id: "tennis_label", attributeValue: "tennis", selected: false },
            { id: "golf_label", attributeValue: "golf", selected: false },
          ]),
        expectCss: el =>
          expect(inputs(el).map(input => Object.assign(attributesOf(input), { id: DOM_SCOPE_LESS(input.id) }))).toEqual([
            { type: "checkbox", name: CHOICE_ID, value: "tennis", id: `${CHOICE_ID}-tennis_label` },
            { type: "checkbox", name: CHOICE_ID, value: "golf", id: `${CHOICE_ID}-golf_label` },
          ]),
      },
      {
        name: "a pre-selected option starts checked",
        patch: { values: [CHOICE_VALUES[0], { ...CHOICE_VALUES[1], selected: true }] },
        expectModel: m => expect(m.configuration.values.map(value => value.selected)).toEqual([false, true]),
        expectCss: el => expect(inputs(el).map(input => input.checked)).toEqual([false, true]),
      },
      {
        name: "a single option renders as a plain box, without a fieldset",
        patch: { attributeType: "boolean", values: [CHOICE_VALUES[0]] },
        expectModel: m => expect(m.configuration.values).toHaveLength(1),
        expectCss: el => expect(el.tagName).toBe("DIV"),
      },
      {
        name: "an option label comes from texts, and falls back to the value written on the profile",
        patch: { values: [CHOICE_VALUES[0], { id: "unknown_key", attributeValue: "padel" }] },
        expectModel: m => expect(m.configuration.values.map(value => value.id)).toEqual(["tennis_label", "unknown_key"]),
        expectCss: el => expect(optionTexts(el)).toEqual(["Tennis", "padel"]),
      },
      {
        name: "a lone array option is a box that still writes a list",
        patch: { values: [CHOICE_VALUES[0]] },
        expectModel: m =>
          expect([m.configuration.attributeType, m.configuration.values]).toEqual([
            ProfileAttributeType.ARRAY,
            [{ id: "tennis_label", attributeValue: "tennis", selected: false }],
          ]),
        expectCss: el => {
          expect(el.tagName).toBe("DIV");
          expect(inputs(el).map(input => input.type)).toEqual(["checkbox"]);
        },
      },
    ],
  },
  required: {
    cases: [
      {
        name: "declared on a checkbox group → the star, never aria-required, which its group role refuses",
        patch: { required: true },
        expectModel: m => expect(m.required).toBe(true),
        expectCss: el => {
          expect([el.getAttribute("role"), el.getAttribute("aria-required")]).toEqual([null, null]);
          expect(el.querySelector(".iam-field-label-required")?.textContent).toBe("*");
          expect(inputs(el).some(input => input.required)).toBe(false);
        },
      },
      {
        name: "declared on a radio group → the radiogroup role announces it",
        patch: { choiceType: "radio", attributeType: "string", required: true },
        expectCss: el => {
          expect([el.getAttribute("role"), el.getAttribute("aria-required")]).toEqual(["radiogroup", "true"]);
          expect(inputs(el).some(input => input.required)).toBe(false);
        },
      },
      {
        name: "omitted → nothing announced",
        expectModel: m => expect(m.required).toBe(false),
        expectCss: el => expect(el.getAttribute("aria-required")).toBeNull(),
      },
      {
        name: "on a lone box, the group is the control: it announces it itself",
        patch: { attributeType: "boolean", values: [CHOICE_VALUES[0]], required: true },
        expectCss: el => {
          expect(inputs(el).map(input => input.getAttribute("aria-required"))).toEqual(["true"]);
          expect(el.getAttribute("aria-required")).toBeNull();
        },
      },
    ],
  },
  minMax: {
    cssExpression: "none",
    cases: [
      {
        name: "declared → the selection bounds of an array group, the maximum capped by the option count",
        patch: { minMax: [1, 5] },
        expectModel: m => expect([m.configuration.minSelected, m.configuration.maxSelected]).toEqual([1, CHOICE_VALUES.length]),
      },
      {
        name: "zero means no constraint on either side",
        patch: { minMax: [0, 0] },
        expectModel: m => expect([m.configuration.minSelected, m.configuration.maxSelected]).toEqual([undefined, undefined]),
      },
      {
        name: "a count has no meaning on a boolean choice",
        patch: { attributeType: "boolean", values: [CHOICE_VALUES[0]], minMax: [1, 1] },
        expectModel: m => expect([m.configuration.minSelected, m.configuration.maxSelected]).toEqual([undefined, undefined]),
      },
    ],
  },
  labelTextId: {
    cases: [
      {
        name: "resolved → the group is named by its legend",
        expectModel: m => expect(m.configuration.labelTextId).toBe("sports_label"),
        expectCss: el => expect(el.querySelector("legend.iam-field-label")?.textContent).toBe("Favourite sports"),
      },
      {
        name: "unresolved → no label node at all",
        patch: { labelTextId: "missing_key" },
        expectModel: m => expect(m.configuration.labelTextId).toBe("missing_key"),
        expectCss: el => expect(el.querySelector(".iam-field-label")).toBeNull(),
      },
      {
        name: "absent → no label node at all",
        patch: { labelTextId: null },
        expectModel: m => expect(m.configuration.labelTextId).toBeUndefined(),
        expectCss: el => expect(el.querySelector(".iam-field-label")).toBeNull(),
      },
    ],
  },
  labelVisible: {
    cases: [
      {
        name: "false → the label stays in the DOM and names the group, with no aria-label",
        patch: { labelVisible: false },
        expectModel: m => expect(m.configuration.labelVisible).toBe(false),
        expectCss: el => {
          expect(el.querySelector("legend.iam-field-label")?.classList.contains("iam-field-label--hidden")).toBe(true);
          expect(el.getAttribute("aria-label")).toBeNull();
        },
      },
      {
        name: "omitted → the label is shown and carries no aria-label on the group",
        expectModel: m => expect(m.configuration.labelVisible).toBe(true),
        expectCss: el => {
          expect(el.querySelector(".iam-field-label")?.classList.contains("iam-field-label--hidden")).toBe(false);
          expect(el.getAttribute("aria-label")).toBeNull();
        },
      },
      {
        name: "visible → the legend names itself",
        patch: { labelVisible: true },
        expectCss: el => expect(el.querySelector("legend.iam-field-label")?.getAttribute("aria-label")).toBe("Favourite sports"),
      },
    ],
  },
  hideOn: {
    cssExpression: "none",
    cases: [
      {
        name: "a form component always takes part in the submit, so it is never hidden by the breakpoint",
        patch: { hideOn: "mobile" },
        expectModel: m => expect(m.configuration).not.toHaveProperty("hideOn"),
      },
    ],
  },
  validation: {
    cssExpression: "none",
    cases: [
      {
        name: "a choice has no format rule: only a selection count",
        patch: { validation: { regex: "^a" } },
        expectModel: m => expect(m).not.toHaveProperty("validation"),
      },
    ],
  },
};

type UncoveredChoiceProp = Exclude<keyof Omit<MessageChoicePayload, "type" | "id">, keyof typeof styleProps | keyof typeof behaviorProps>;
export type EveryChoicePropIsCovered = AssertNever<UncoveredChoiceProp>;

// The three option keys are proven by the values rows above; a fourth key must add its own.
type UncoveredChoiceValueProp = Exclude<keyof MessageChoiceValuePayload, "id" | "attributeValue" | "selected">;
export type EveryChoiceValuePropIsCovered = AssertNever<UncoveredChoiceValueProp>;

const spec: ComponentMatrixSpec<BehaviorProps, MessageChoiceModel> = {
  label: "Choice behavior",
  buildPayload: buildChoiceMessage,
  select: message => selectFirstChild<MessageChoiceModel>(message, "choice"),
  props: behaviorProps,
};

runComponentMatrix(spec);

describe("Choice behavior · rejections", () => {
  const warn = jest.spyOn(Log, "warn");

  beforeEach(() => warn.mockImplementation(() => undefined));
  afterEach(() => warn.mockReset());

  test.each([
    ["no control", { choiceType: undefined }],
    ["an unknown control", { choiceType: "dropdown" }],
    ["a radio offering a single option", { choiceType: "radio", attributeType: "string", values: [CHOICE_VALUES[0]] }],
    ["no usable option", { values: [{ id: "", attributeValue: "" }] }],
    ["the reserved decoy target", { mapsTo: "$honeypot" }],
    ["a checkbox asked to write a date", { attributeType: "date" }],
    ["a radio asked to write an array", { choiceType: "radio", attributeType: "array" }],
    ["a checkbox asked to write a scalar", { attributeType: "integer" }],
    ["a boolean checkbox offering two options", { attributeType: "boolean" }],
  ])("%s drops the choice and warns", (_label, patch) => {
    const message = normalizeMessage(buildChoiceMessage(patch));

    expect(message.root.children.some(child => child.type === "choice")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(CHOICE_ID));
  });
  test("the submit button survives the dropped choice", () => {
    const message = normalizeMessage(buildChoiceMessage({ choiceType: undefined }));

    expect(message.root.children).toHaveLength(1);
    expect(message.root.children[0]?.type).toBe("button");
  });
});

describe("Choice behavior · a badly typed option", () => {
  const debug = jest.spyOn(Log, "debug");

  beforeEach(() => debug.mockImplementation(() => undefined));
  afterEach(() => debug.mockReset());

  test("is dropped alone, like a duplicate: the rest of the group survives", () => {
    const message = normalizeMessage(
      buildChoiceMessage({
        choiceType: "radio",
        attributeType: "integer",
        values: [
          { id: "one", attributeValue: "1" },
          { id: "half", attributeValue: "1.5" },
          { id: "two", attributeValue: "2" },
        ],
      })
    );
    const choice = selectFirstChild<MessageChoiceModel>(message, "choice");

    expect(choice.configuration.values.map(value => value.attributeValue)).toEqual(["1", "2"]);
    expect(debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('"1.5" is not a valid integer'));
  });
});
