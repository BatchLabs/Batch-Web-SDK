/* eslint-env jest */

import {
  ATTRIBUTE_KINDS,
  type AttributeKind,
  isInputAttributeType,
  PROFILE_ATTRIBUTE_TYPES,
} from "com.batch.dom/render/model/attribute-kinds";
import type { MessageAttributeType } from "com.batch.dom/render/model/types";
import { ATTRIBUTE_TYPE_CASES, ATTRIBUTE_TYPES } from "com.batch.dom/render/test-utils/factories/attribute-type-cases";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

const ACCEPTED: [MessageAttributeType, string, FormFieldValue][] = ATTRIBUTE_TYPES.flatMap(type =>
  ATTRIBUTE_TYPE_CASES[type].accepted.map(({ text, value }): [MessageAttributeType, string, FormFieldValue] => [type, text, value])
);

const REFUSED: [MessageAttributeType, string][] = ATTRIBUTE_TYPES.flatMap(type =>
  ATTRIBUTE_TYPE_CASES[type].refused.map((text): [MessageAttributeType, string] => [type, text])
);

/** The kind that parses a payload attribute type; an array parses each member as a string. */
function kindOf(type: MessageAttributeType): AttributeKind {
  const profileType = PROFILE_ATTRIBUTE_TYPES[type];
  return ATTRIBUTE_KINDS[profileType === ProfileAttributeType.ARRAY ? ProfileAttributeType.STRING : profileType];
}

describe("attribute kinds", () => {
  it.each(ACCEPTED)("a %s kind parses %s into its typed value", (type, text, expected) => {
    expect(kindOf(type).parse(text)).toEqual(expected);
  });

  it.each(REFUSED)("a %s kind refuses %s", (type, text) => {
    expect(kindOf(type).parse(text)).toBeNull();
  });

  it("a negative zero is parsed, and is the zero JSON prints", () => {
    const integer = ATTRIBUTE_KINDS[ProfileAttributeType.INTEGER].parse("-0");
    const float = ATTRIBUTE_KINDS[ProfileAttributeType.FLOAT].parse("-0");

    expect(Object.is(integer?.value, -0)).toBe(true);
    expect(Object.is(float?.value, -0)).toBe(true);
    expect(JSON.stringify(integer?.value)).toBe("0");
    expect(JSON.stringify(float?.value)).toBe("0");
  });

  it("the float pattern caps the integer part, not the fraction", () => {
    expect(ATTRIBUTE_KINDS[ProfileAttributeType.FLOAT].parse("1.00000000000000001")).toEqual({
      type: ProfileAttributeType.FLOAT,
      value: 1,
    });
  });

  it("a url kind keeps what the profile would keep, credentials and fragment included", () => {
    expect(String(ATTRIBUTE_KINDS[ProfileAttributeType.URL].parse("https://user:pw@batch.com/p#frag")?.value)).toBe(
      "https://user:pw@batch.com/p#frag"
    );
  });

  it("every scalar a text field can collect, and no other", () => {
    const collectable = Object.values(PROFILE_ATTRIBUTE_TYPES).filter(isInputAttributeType);

    expect(collectable).toEqual([
      ProfileAttributeType.STRING,
      ProfileAttributeType.INTEGER,
      ProfileAttributeType.FLOAT,
      ProfileAttributeType.DATE,
      ProfileAttributeType.URL,
    ]);
  });
});
