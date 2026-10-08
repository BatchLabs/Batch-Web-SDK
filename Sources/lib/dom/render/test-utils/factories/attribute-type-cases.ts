import { isInputAttributeType, PROFILE_ATTRIBUTE_TYPES } from "com.batch.dom/render/model/attribute-kinds";
import type { MessageAttributeType, MessageChoiceValuePayload } from "com.batch.dom/render/model/types";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { Consts } from "com.batch.shared/constants/user";
import { type PartialUpdateObject, ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

export interface AttributeTypeCases {
  /** Texts the kind parses and the value each yields; the first is the canonical sample every layer reuses. */
  accepted: { text: string; value: FormFieldValue }[];
  refused: string[];
  /** How the collected sample lands in `custom_attributes`: key suffix and JSON value. */
  wire: { suffix: ProfileAttributeType; json: string | number | boolean | PartialUpdateObject };
}

const STRING_BOUND = "x".repeat(Consts.AttributeStringMaxLengthCEP);
/** The bound in UTF-8 bytes, reached with 2-byte letters and 4-byte emoji: half and a quarter as many characters. */
const ACCENTED_BOUND = "é".repeat(Consts.AttributeStringMaxLengthCEP / 2);
const EMOJI_BOUND = "😀".repeat(Consts.AttributeStringMaxLengthCEP / 4);
const URL_ORIGIN = "https://batch.com/";
const CANONICAL_URL = "https://batch.com/pricing";
/** The epoch of `2026-09-09` UTC, written out: every layer promises this number on the wire. */
const CANONICAL_DATE_EPOCH = 1788912000000;

/** A date value at a UTC instant written out, never derived from the text under test. */
const dateAt = (instant: string): FormFieldValue => ({ type: ProfileAttributeType.DATE, value: new Date(instant) });
const urlValue = (text: string): FormFieldValue => ({ type: ProfileAttributeType.URL, value: new URL(text) });

export const ATTRIBUTE_TYPE_CASES = {
  string: {
    accepted: [
      { text: "ok", value: { type: ProfileAttributeType.STRING, value: "ok" } },
      { text: STRING_BOUND, value: { type: ProfileAttributeType.STRING, value: STRING_BOUND } },
      { text: ACCENTED_BOUND, value: { type: ProfileAttributeType.STRING, value: ACCENTED_BOUND } },
      { text: EMOJI_BOUND, value: { type: ProfileAttributeType.STRING, value: EMOJI_BOUND } },
      // The kind stores what was typed: trimming is the caller's business.
      { text: "  padded  ", value: { type: ProfileAttributeType.STRING, value: "  padded  " } },
    ],
    refused: ["", `${STRING_BOUND}x`, `${ACCENTED_BOUND}é`, `${EMOJI_BOUND}😀`],
    wire: { suffix: ProfileAttributeType.STRING, json: "ok" },
  },
  boolean: {
    accepted: [
      { text: "true", value: { type: ProfileAttributeType.BOOLEAN, value: true } },
      { text: "false", value: { type: ProfileAttributeType.BOOLEAN, value: false } },
    ],
    refused: ["yes", "True", "TRUE", "1", "0", " true"],
    wire: { suffix: ProfileAttributeType.BOOLEAN, json: true },
  },
  integer: {
    accepted: [
      { text: "3", value: { type: ProfileAttributeType.INTEGER, value: 3 } },
      { text: "-3", value: { type: ProfileAttributeType.INTEGER, value: -3 } },
      { text: "0", value: { type: ProfileAttributeType.INTEGER, value: 0 } },
      // 15 digits is the last width `Number.isSafeInteger` covers.
      { text: "999999999999999", value: { type: ProfileAttributeType.INTEGER, value: 999999999999999 } },
    ],
    refused: ["3.5", "abc", "1234567890123456", "1e3", "+5", " 12 ", "١٢", "NaN", "Infinity", ""],
    wire: { suffix: ProfileAttributeType.INTEGER, json: 3 },
  },
  float: {
    accepted: [
      { text: "2", value: { type: ProfileAttributeType.FLOAT, value: 2 } },
      { text: "2.5", value: { type: ProfileAttributeType.FLOAT, value: 2.5 } },
      { text: "-0.5", value: { type: ProfileAttributeType.FLOAT, value: -0.5 } },
      { text: "999999999999999.999", value: { type: ProfileAttributeType.FLOAT, value: Number("999999999999999.999") } },
    ],
    // The kind refuses a comma; only a float text field's input reads it as the decimal separator.
    refused: ["1.", "2,5", ".5", "1e3", "+2.5", "Infinity", "NaN", ""],
    // An integral float keeps its own suffix: the type is declared, not guessed from the value.
    wire: { suffix: ProfileAttributeType.FLOAT, json: 2 },
  },
  date: {
    accepted: [
      { text: "2026-09-09", value: { type: ProfileAttributeType.DATE, value: new Date(CANONICAL_DATE_EPOCH) } },
      { text: "2026-09-09T00:00:00.000Z", value: { type: ProfileAttributeType.DATE, value: new Date(CANONICAL_DATE_EPOCH) } },
      { text: "2026-09-09T10:30:00+02:00", value: dateAt("2026-09-09T08:30:00.000Z") },
      { text: "2026-09-09T10:00-05:30", value: dateAt("2026-09-09T15:30:00.000Z") },
      { text: "2024-02-29", value: dateAt("2024-02-29T00:00:00.000Z") },
      // The profile API writes a date as epoch milliseconds, which `Date.parse` cannot read.
      { text: String(CANONICAL_DATE_EPOCH), value: { type: ProfileAttributeType.DATE, value: new Date(CANONICAL_DATE_EPOCH) } },
      // The content API allows lowercase and up to 9 fraction digits; the instant keeps milliseconds.
      { text: "2026-09-09t10:30+02:00", value: dateAt("2026-09-09T08:30:00.000Z") },
      { text: "2026-09-09t10:00z", value: dateAt("2026-09-09T10:00:00.000Z") },
      { text: "2026-09-09T10:00:00.123456789Z", value: dateAt("2026-09-09T10:00:00.123Z") },
    ],
    // A datetime without a zone names no instant; impossible calendar dates are refused too.
    refused: [
      "yesterday",
      "2026-09-09T25:00",
      "2026-09-09T24:00Z",
      "",
      "2026-13-01",
      "2026-09-09T10:30:00",
      "2026-09-09T10:00",
      "2026-02-30",
    ],
    wire: { suffix: ProfileAttributeType.DATE, json: CANONICAL_DATE_EPOCH },
  },
  url: {
    accepted: [
      { text: CANONICAL_URL, value: urlValue(CANONICAL_URL) },
      // A bare origin gains the root path the parser adds.
      { text: "https://batch.com", value: urlValue("https://batch.com") },
      { text: "https://batch.com/a b", value: urlValue("https://batch.com/a b") },
    ],
    // A url needs a scheme and a host, matching the content API's check.
    refused: [
      "notaurl",
      "//batch.com",
      "/relative",
      "",
      "mailto:sales@batch.com",
      "javascript:alert(1)",
      `${URL_ORIGIN}${"a".repeat(Consts.AttributeURLMaxLength)}`,
    ],
    wire: { suffix: ProfileAttributeType.URL, json: CANONICAL_URL },
  },
  array: {
    accepted: [
      { text: "tag", value: { type: ProfileAttributeType.STRING, value: "tag" } },
      { text: STRING_BOUND, value: { type: ProfileAttributeType.STRING, value: STRING_BOUND } },
      { text: ACCENTED_BOUND, value: { type: ProfileAttributeType.STRING, value: ACCENTED_BOUND } },
    ],
    refused: ["", `${STRING_BOUND}x`, `${ACCENTED_BOUND}é`],
    wire: { suffix: ProfileAttributeType.ARRAY, json: { $add: ["tag"] } },
  },
} satisfies Record<MessageAttributeType, AttributeTypeCases>;

/** Every payload attribute type, in table order. */
export const ATTRIBUTE_TYPES = Object.keys(ATTRIBUTE_TYPE_CASES) as MessageAttributeType[];

/** Every type a single control can hold on its own; `array` needs a group. */
export const SCALAR_ATTRIBUTE_TYPES = ATTRIBUTE_TYPES.filter((type): type is Exclude<MessageAttributeType, "array"> => type !== "array");

export const TEXT_FIELD_ATTRIBUTE_TYPES = SCALAR_ATTRIBUTE_TYPES.filter(type => isInputAttributeType(PROFILE_ATTRIBUTE_TYPES[type]));

/** The value a form collects for `type`, as `wire` describes it: an array group adds its canonical member, a control holds its canonical sample. */
export function collectedSample(type: MessageAttributeType): FormFieldValue {
  const [canonical] = ATTRIBUTE_TYPE_CASES[type].accepted;
  return type === "array" ? { type: ProfileAttributeType.ARRAY, value: { $add: [canonical.text] } } : canonical.value;
}

/** Two options a radio of each scalar type accepts, so a group can be built for any of them. */
export const RADIO_OPTIONS: Record<Exclude<MessageAttributeType, "array">, MessageChoiceValuePayload[]> = {
  string: [
    { id: "opt_a", attributeValue: ATTRIBUTE_TYPE_CASES.string.accepted[0].text },
    { id: "opt_b", attributeValue: "other" },
  ],
  boolean: [
    { id: "opt_a", attributeValue: "true" },
    { id: "opt_b", attributeValue: "false" },
  ],
  integer: [
    { id: "opt_a", attributeValue: ATTRIBUTE_TYPE_CASES.integer.accepted[0].text },
    { id: "opt_b", attributeValue: ATTRIBUTE_TYPE_CASES.integer.accepted[1].text },
  ],
  float: [
    { id: "opt_a", attributeValue: ATTRIBUTE_TYPE_CASES.float.accepted[0].text },
    { id: "opt_b", attributeValue: ATTRIBUTE_TYPE_CASES.float.accepted[1].text },
  ],
  date: [
    { id: "opt_a", attributeValue: ATTRIBUTE_TYPE_CASES.date.accepted[0].text },
    { id: "opt_b", attributeValue: "2026-09-10" },
  ],
  url: [
    { id: "opt_a", attributeValue: ATTRIBUTE_TYPE_CASES.url.accepted[0].text },
    { id: "opt_b", attributeValue: "https://batch.com/docs" },
  ],
};
