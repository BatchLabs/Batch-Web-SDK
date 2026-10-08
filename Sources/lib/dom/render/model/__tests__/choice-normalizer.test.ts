/* eslint-env jest */

import type { MessageChoiceModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import {
  DEFAULT_CHOICE_SPACING,
  DEFAULT_FIELD_FONT_SIZE,
  DEFAULT_INPUT_BORDER_COLOR,
} from "com.batch.dom/render/model/normalizer-defaults";
import { analyzeFormTree } from "com.batch.dom/render/render/form-setup";
import {
  ATTRIBUTE_TYPE_CASES,
  RADIO_OPTIONS,
  SCALAR_ATTRIBUTE_TYPES,
} from "com.batch.dom/render/test-utils/factories/attribute-type-cases";
import { buildChoiceMessage, CHOICE_VALUES } from "com.batch.dom/render/test-utils/factories/choice-payloads";
import { componentMessage } from "com.batch.dom/render/test-utils/prop-matrix";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

function normalizeChoicePayload(patch: Record<string, unknown>): MessageChoiceModel | null {
  const message = normalizeMessage(buildChoiceMessage(patch));
  return message.root.children.find((child): child is MessageChoiceModel => child?.type === "choice") ?? null;
}

const checkbox = (patch: Record<string, unknown> = {}): MessageChoiceModel | null => normalizeChoicePayload(patch);

const radio = (patch: Record<string, unknown> = {}): MessageChoiceModel | null =>
  normalizeChoicePayload({ choiceType: "radio", attributeType: "string", ...patch });

describe("choice attribute type", () => {
  test("an undeclared radio writes the one scalar a radio holds", () => {
    expect(radio({ attributeType: undefined })?.configuration.attributeType).toBe(ProfileAttributeType.STRING);
  });

  test("an undeclared type the profile does not know falls back the same way", () => {
    expect(radio({ attributeType: "money" })?.configuration.attributeType).toBe(ProfileAttributeType.STRING);
  });

  test("an undeclared checkbox writes the list or the truth its options describe, never nothing", () => {
    expect(checkbox({ attributeType: undefined })?.configuration.attributeType).toBe(ProfileAttributeType.ARRAY);
    expect(checkbox({ attributeType: undefined, values: [CHOICE_VALUES[0]] })?.configuration.attributeType).toBe(
      ProfileAttributeType.BOOLEAN
    );
  });

  test("the fallback counts the options the payload offers, before the kept list narrows them", () => {
    const unusable = checkbox({ attributeType: undefined, values: [CHOICE_VALUES[0], { id: "", attributeValue: "" }] });
    expect(unusable?.configuration.attributeType).toBe(ProfileAttributeType.BOOLEAN);
    expect(unusable?.configuration.values).toHaveLength(1);

    const duplicate = checkbox({ attributeType: undefined, values: [CHOICE_VALUES[0], { id: "other", attributeValue: "tennis" }] });
    expect(duplicate?.configuration.attributeType).toBe(ProfileAttributeType.ARRAY);
    expect(duplicate?.configuration.values).toHaveLength(1);
  });

  test("a declared type always wins over the fallback", () => {
    expect(checkbox({ attributeType: "boolean", values: [CHOICE_VALUES[0]] })?.configuration.attributeType).toBe(
      ProfileAttributeType.BOOLEAN
    );
    expect(radio({ attributeType: "integer", values: RADIO_OPTIONS.integer })?.configuration.attributeType).toBe(
      ProfileAttributeType.INTEGER
    );
  });

  test.each([
    ["radio", "array"],
    ["checkbox", "string"],
    ["checkbox", "integer"],
    ["checkbox", "date"],
  ])("drops a %s that cannot write a %s", (choiceType, attributeType) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    expect(normalizeChoicePayload({ choiceType, attributeType, values: CHOICE_VALUES })).toBeNull();
    warn.mockRestore();
  });

  test("a boolean checkbox holds exactly one option: its checked state is the whole value", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    expect(checkbox({ attributeType: "boolean" })).toBeNull();
    expect(checkbox({ attributeType: "boolean", values: [CHOICE_VALUES[0]] })?.configuration.attributeType).toBe(
      ProfileAttributeType.BOOLEAN
    );
    warn.mockRestore();
  });

  test("a checkbox writing an array keeps its single option: one tag is a legitimate group", () => {
    const model = checkbox({ values: [CHOICE_VALUES[0]] });

    expect(model?.configuration.attributeType).toBe(ProfileAttributeType.ARRAY);
    expect(model?.configuration.values).toHaveLength(1);
  });

  test("a boolean checkbox never judges its option text", () => {
    const model = checkbox({ attributeType: "boolean", values: [{ id: "c", attributeValue: "whatever" }] });

    expect(model?.configuration.attributeType).toBe(ProfileAttributeType.BOOLEAN);
  });

  test("an array checkbox still holds each option to the profile string bound", () => {
    const long = { id: "long", attributeValue: "x".repeat(Consts.AttributeStringMaxLengthCEP + 1) };

    const model = checkbox({ values: [...CHOICE_VALUES, long] });

    expect(model?.configuration.values.map(value => value.id)).toEqual(["tennis_label", "golf_label"]);
  });

  test("an array checkbox bounds an option in UTF-8 bytes, the unit the server refuses a member in", () => {
    const accented = { id: "accented", attributeValue: "é".repeat(Consts.AttributeStringMaxLengthCEP / 2 + 1) };

    const model = checkbox({ values: [...CHOICE_VALUES, accented] });

    expect(model?.configuration.values.map(value => value.id)).toEqual(["tennis_label", "golf_label"]);
  });

  test.each(SCALAR_ATTRIBUTE_TYPES)("a %s radio keeps every option its kind accepts, in payload order", attributeType => {
    const options = RADIO_OPTIONS[attributeType];

    const model = radio({ attributeType, values: options });

    expect(model?.configuration.values.map(value => value.attributeValue)).toEqual(options.map(option => option.attributeValue));
  });

  test.each(SCALAR_ATTRIBUTE_TYPES)("a %s radio drops the one option its kind refuses and keeps the group", attributeType => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    const options = RADIO_OPTIONS[attributeType];

    const model = radio({
      attributeType,
      values: [...options, { id: "bad", attributeValue: ATTRIBUTE_TYPE_CASES[attributeType].refused[0] }],
    });

    expect(model?.configuration.values.map(value => value.id)).toEqual(options.map(option => option.id));
    debug.mockRestore();
  });

  test("a date radio keeps an epoch-millisecond option; a url radio drops one without host", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    const date = radio({ attributeType: "date", values: [...RADIO_OPTIONS.date, { id: "epoch", attributeValue: "1788912000000" }] });
    const url = radio({ attributeType: "url", values: [...RADIO_OPTIONS.url, { id: "mail", attributeValue: "mailto:sales@batch.com" }] });

    expect(date?.configuration.values.map(value => value.id)).toEqual(["opt_a", "opt_b", "epoch"]);
    expect(url?.configuration.values.map(value => value.id)).toEqual(["opt_a", "opt_b"]);
    debug.mockRestore();
  });
});

describe("choice rejections", () => {
  test.each([
    ["no control at all", { choiceType: undefined }],
    ["an unknown control", { choiceType: "dropdown", values: CHOICE_VALUES }],
    ["a radio with a single option", { choiceType: "radio", attributeType: "string", values: [CHOICE_VALUES[0]] }],
    ["a checkbox with no usable option", { choiceType: "checkbox", attributeType: "array", values: [{ id: "", attributeValue: "" }] }],
    ["the reserved decoy target", { choiceType: "checkbox", attributeType: "array", values: CHOICE_VALUES, mapsTo: "$honeypot" }],
    [
      "a native target other than topic preferences",
      { choiceType: "checkbox", attributeType: "array", values: CHOICE_VALUES, mapsTo: "$email_address" },
    ],
    ["topic preferences on a radio", { choiceType: "radio", values: CHOICE_VALUES, mapsTo: "$topic_preferences" }],
    [
      "topic preferences on a boolean checkbox",
      { choiceType: "checkbox", attributeType: "boolean", values: [CHOICE_VALUES[0]], mapsTo: "$topic_preferences" },
    ],
  ])("drops a choice with %s", (_label, patch) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    expect(normalizeChoicePayload(patch)).toBeNull();
    warn.mockRestore();
  });

  test("a native target other than topic preferences is judged before the control", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    expect(normalizeChoicePayload({ choiceType: undefined, mapsTo: "$honeypot" })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('"$topic_preferences" is the only native target'));
    warn.mockRestore();
  });
});

describe("choice options", () => {
  test("keeps the payload order and trims both identities", () => {
    const model = checkbox({ values: [{ id: " b ", attributeValue: " B " }, CHOICE_VALUES[0]] });

    expect(model?.configuration.values).toEqual([
      { id: "b", attributeValue: "B", selected: false },
      { id: "tennis_label", attributeValue: "tennis", selected: false },
    ]);
  });

  test.each([
    ["a custom group", checkbox],
    ["a radio", radio],
  ])("%s keeps two values that differ only by case", (_, build) => {
    const model = build({
      values: [
        { id: "a", attributeValue: "Foot" },
        { id: "b", attributeValue: "foot" },
      ],
    });

    expect(model?.configuration.values.map(value => value.attributeValue)).toEqual(["Foot", "foot"]);
  });

  test("a topic preferences group drops an option whose value differs from a kept one only by case", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    const model = checkbox({
      mapsTo: "$topic_preferences",
      values: [
        { id: "a", attributeValue: "News" },
        { id: "b", attributeValue: "news" },
      ],
    });

    expect(model?.configuration.values).toEqual([{ id: "a", attributeValue: "news", selected: false }]);
    debug.mockRestore();
  });

  test("a topic preferences group keeps only the options that are valid topics, lowercased", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    const model = checkbox({
      mapsTo: "$topic_preferences",
      values: [
        { id: "n", attributeValue: "News" },
        { id: "p", attributeValue: "Promo!" },
      ],
    });

    expect(model?.mapsTo).toBe("$topic_preferences");
    expect(model?.configuration.attributeType).toBe(ProfileAttributeType.ARRAY);
    expect(model?.configuration.values).toEqual([{ id: "n", attributeValue: "news", selected: false }]);
    debug.mockRestore();
  });

  test("drops an option repeating an id or an attribute value", () => {
    const model = checkbox({
      values: [
        CHOICE_VALUES[0],
        { id: "tennis_label", attributeValue: "other" },
        { id: "other", attributeValue: "tennis" },
        CHOICE_VALUES[1],
      ],
    });

    expect(model?.configuration.values.map(value => value.id)).toEqual(["tennis_label", "golf_label"]);
  });

  test("ids are compared as written, values once trimmed", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    const distinctIds = checkbox({
      values: [
        { id: "Tennis", attributeValue: "a" },
        { id: "tennis", attributeValue: "b" },
      ],
    });
    const sameTrimmed = checkbox({
      values: [
        { id: "a", attributeValue: "Foot " },
        { id: "b", attributeValue: "Foot" },
      ],
    });

    expect(distinctIds?.configuration.values.map(value => value.id)).toEqual(["Tennis", "tennis"]);
    expect(sameTrimmed?.configuration.values.map(value => value.id)).toEqual(["a"]);
    debug.mockRestore();
  });

  test.each([
    ["a values list that is not an array", "nope"],
    ["an option declaring only its technical id", [{ id: "orphan" }]],
    ["an option declaring only its attribute value", [{ attributeValue: "orphan" }]],
  ])("drops the choice on %s: nothing is left to submit", (_label, values) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    expect(checkbox({ values })).toBeNull();
    warn.mockRestore();
  });

  test("an option carrying no attribute value never counts against a boolean checkbox", () => {
    const model = checkbox({ attributeType: "boolean", values: [CHOICE_VALUES[0], { id: "silent", attributeValue: "" }] });

    expect(model).not.toBeNull();
    expect(model?.configuration.values).toHaveLength(1);
  });

  test("a checkbox group keeps its first 25 options and only them; a radio keeps every option", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    const many = Array.from({ length: Consts.MaxEventArrayItems + 2 }, (_, i) => ({ id: `o${i}`, attributeValue: `v${i}` }));

    const overflowing = checkbox({ values: many })?.configuration.values ?? [];
    const exact = checkbox({ values: many.slice(0, Consts.MaxEventArrayItems) })?.configuration.values ?? [];
    const radioGroup = radio({ values: many })?.configuration.values ?? [];

    expect(overflowing).toHaveLength(Consts.MaxEventArrayItems);
    expect(overflowing[Consts.MaxEventArrayItems - 1].id).toBe(`o${Consts.MaxEventArrayItems - 1}`);
    expect(exact).toHaveLength(Consts.MaxEventArrayItems);
    expect(radioGroup).toHaveLength(Consts.MaxEventArrayItems + 2);
    debug.mockRestore();
  });

  test("ignores an entry that is not an option object", () => {
    const model = checkbox({ values: [CHOICE_VALUES[0], null, "nope", 42, CHOICE_VALUES[1]] });

    expect(model?.configuration.values.map(value => value.id)).toEqual(["tennis_label", "golf_label"]);
  });
});

describe("choice pre-selection", () => {
  test("a checkbox group keeps every pre-checked option", () => {
    const model = checkbox({ values: CHOICE_VALUES.map(value => ({ ...value, selected: true })) });

    expect(model?.configuration.values.map(value => value.selected)).toEqual([true, true]);
  });

  test("a radio group keeps only the first pre-checked option", () => {
    const model = radio({ values: CHOICE_VALUES.map(value => ({ ...value, selected: true })) });

    expect(model?.configuration.values.map(value => value.selected)).toEqual([true, false]);
  });

  test("only a strict true pre-selects", () => {
    const stringly = checkbox({ values: CHOICE_VALUES.map(value => ({ ...value, selected: "true" })) });
    const numeric = checkbox({ values: CHOICE_VALUES.map(value => ({ ...value, selected: 1 })) });

    expect(stringly?.configuration.values.map(value => value.selected)).toEqual([false, false]);
    expect(numeric?.configuration.values.map(value => value.selected)).toEqual([false, false]);
  });

  test("names the payload index of the pre-selection it drops, not the compacted one", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    radio({
      values: [
        { id: "first", attributeValue: "first", selected: true },
        { id: "", attributeValue: "" },
        { id: "third", attributeValue: "third", selected: true },
      ],
    });

    expect(debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("choice.values[2].selected"));
    debug.mockRestore();
  });
});

describe("choice selection bounds", () => {
  test("an array choice reads its bounds and never lets either exceed the option count", () => {
    expect(checkbox({ minMax: [1, 0] })?.configuration).toMatchObject({ minSelected: 1, maxSelected: undefined });
    expect(checkbox({ minMax: [0, 5] })?.configuration).toMatchObject({ minSelected: undefined, maxSelected: 2 });
    expect(checkbox({ minMax: [5, 0] })?.configuration).toMatchObject({ minSelected: 2, maxSelected: undefined });
  });

  test("a boolean, a string or an integer choice carries no bounds", () => {
    expect(checkbox({ attributeType: "boolean", values: [CHOICE_VALUES[0]], minMax: [1, 1] })?.configuration).toMatchObject({
      minSelected: undefined,
      maxSelected: undefined,
    });
    expect(radio({ minMax: [1, 1] })?.configuration).toMatchObject({ minSelected: undefined, maxSelected: undefined });
    expect(radio({ attributeType: "integer", values: RADIO_OPTIONS.integer, minMax: [1, 1] })?.configuration).toMatchObject({
      minSelected: undefined,
      maxSelected: undefined,
    });
  });
});

describe("choice configuration", () => {
  test("an unstyled choice matches the fields around it", () => {
    const model = checkbox({ mapsTo: undefined });

    expect(model?.mapsTo).toBeUndefined();
    expect(model?.required).toBe(false);
    expect(model?.configuration).toMatchObject({
      layout: "vertical",
      align: "left",
      spacing: DEFAULT_CHOICE_SPACING,
      checkedColor: DEFAULT_INPUT_BORDER_COLOR,
      borderColor: DEFAULT_INPUT_BORDER_COLOR,
      labelVisible: true,
    });
    expect(model?.configuration.fontStyle.fontSize).toBe(DEFAULT_FIELD_FONT_SIZE);
    expect(model?.configuration.fontStyle.fontDecoration).toEqual([]);
  });

  test("a negative font size falls back to the field default", () => {
    expect(checkbox({ fontSize: -1 })?.configuration.fontStyle.fontSize).toBe(DEFAULT_FIELD_FONT_SIZE);
    expect(checkbox({ fontSize: 0 })?.configuration.fontStyle.fontSize).toBe(0);
  });

  test("reads the style values the payload declares", () => {
    const model = checkbox({ layout: "horizontal", align: "center", spacing: 12, fontSize: 18, fontSizeDesktop: 20 });

    expect(model?.configuration).toMatchObject({ layout: "horizontal", align: "center", spacing: 12 });
    expect(model?.configuration.fontStyle).toMatchObject({ fontSize: 18, fontSizeDesktop: 20 });
  });

  test("carries a required choice as required", () => {
    expect(checkbox({ required: true })?.required).toBe(true);
  });

  test("treats a blank profile target as no target at all", () => {
    expect(checkbox({ mapsTo: "   " })?.mapsTo).toBeUndefined();
  });

  test("an unsupported property is diagnosed, never fatal", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    expect(checkbox({ validation: { regex: "^a" }, hideOn: "mobile", padding: [8, 8, 8, 8], radius: [4, 4, 4, 4] })).not.toBeNull();
    debug.mockRestore();
  });
});

describe("choice in a message tree", () => {
  test("a page holding only a choice still carries a form", () => {
    const message = normalizeMessage(
      componentMessage({
        type: "choice",
        id: "consent",
        mapsTo: "newsletter",
        choiceType: "checkbox",
        attributeType: "boolean",
        values: [{ id: "consent_label", attributeValue: "yes" }],
      })
    );

    expect(message.root.children).toHaveLength(1);
    expect(analyzeFormTree(message).hasFields).toBe(true);
  });
});
