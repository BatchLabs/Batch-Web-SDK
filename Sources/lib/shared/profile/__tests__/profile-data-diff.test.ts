import deepClone from "../../helpers/object-deep-clone";
import { hasProfileDataChanged } from "../profile-data-diff";
import { ProfileAttributeType, ProfileCustomDataAttributes } from "../profile-data-types";

it("returns a change on different attributes", () => {
  const oldAttributes: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.INTEGER,
      value: 26,
    },
    os: {
      type: ProfileAttributeType.STRING,
      value: "linux",
    },
  };
  const oldAttributesSnapshot = deepClone(oldAttributes);

  const attribute1: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.INTEGER,
      value: 27,
    },
    os: {
      type: ProfileAttributeType.STRING,
      value: "linux",
    },
  };

  const attribute2: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.STRING,
      value: "27",
    },
    os: {
      type: ProfileAttributeType.STRING,
      value: "linux",
    },
  };

  const attribute3: ProfileCustomDataAttributes = {
    os: {
      type: ProfileAttributeType.STRING,
      value: "linux",
    },
  };

  const attribute4: ProfileCustomDataAttributes = {
    os: {
      type: ProfileAttributeType.STRING,
      value: "test",
    },
  };

  const attribute5: ProfileCustomDataAttributes = {
    test: {
      type: ProfileAttributeType.STRING,
      value: "test",
    },
  };

  const attribute6: ProfileCustomDataAttributes = {};

  expect(hasProfileDataChanged(oldAttributes, attribute1)).toBe(true);
  expect(hasProfileDataChanged(oldAttributes, attribute2)).toBe(true);
  expect(hasProfileDataChanged(oldAttributes, attribute3)).toBe(true);
  expect(hasProfileDataChanged(oldAttributes, attribute4)).toBe(true);
  expect(hasProfileDataChanged(oldAttributes, attribute5)).toBe(true);
  expect(hasProfileDataChanged(oldAttributes, attribute6)).toBe(true);
  expect(hasProfileDataChanged(attribute6, oldAttributes)).toBe(true);

  // Make sure that the data didn't get mutated
  expect(oldAttributes).toEqual(oldAttributesSnapshot);
});

it("returns a change on different tags", () => {
  const oldTags: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["bar", "baz"]),
    },
    os: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["linux"]),
    },
  };
  const oldTagsSnapshot = deepClone(oldTags);

  const newTags1: ProfileCustomDataAttributes = {
    editor: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["vim"]),
    },
  };
  const newTags2: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["bar", "baz", "bap"]),
    },
    os: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["linux"]),
    },
  };
  const newTags3: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["bar"]),
    },
    os: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["linux"]),
    },
  };
  const newTags4: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["bar"]),
    },
    os: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["linux"]),
    },
  };
  const newTags5: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["bar", "baz"]),
    },
  };
  const newTags6: ProfileCustomDataAttributes = {};

  expect(hasProfileDataChanged(oldTags, newTags1)).toBe(true);
  expect(hasProfileDataChanged(oldTags, newTags2)).toBe(true);
  expect(hasProfileDataChanged(oldTags, newTags3)).toBe(true);
  expect(hasProfileDataChanged(oldTags, newTags4)).toBe(true);
  expect(hasProfileDataChanged(oldTags, newTags5)).toBe(true);
  expect(hasProfileDataChanged(oldTags, newTags6)).toBe(true);
  expect(hasProfileDataChanged(newTags6, oldTags)).toBe(true);

  // Make sure that the data didn't get mutated
  expect(oldTags).toEqual(oldTagsSnapshot);
});

it("returns no change on same attributes", () => {
  expect(hasProfileDataChanged({}, {})).toBe(false);

  const attributes: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.INTEGER,
      value: 26,
    },
    os: {
      type: ProfileAttributeType.STRING,
      value: "linux",
    },
  };

  expect(hasProfileDataChanged(attributes, deepClone(attributes))).toBe(false);
});

it("returns no change same tags", () => {
  const tags: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["bar", "baz"]),
    },
    os: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["linux"]),
    },
  };

  expect(hasProfileDataChanged(tags, deepClone(tags))).toBe(false);
});

it("returns no change same tags and attributes", () => {
  const tags: ProfileCustomDataAttributes = {};

  const attributes: ProfileCustomDataAttributes = {
    foobar: {
      type: ProfileAttributeType.INTEGER,
      value: 26,
    },
    os: {
      type: ProfileAttributeType.STRING,
      value: "linux",
    },
    foobar2: {
      type: ProfileAttributeType.ARRAY,
      value: new Set(["bar", "baz"]),
    },
  };

  expect(hasProfileDataChanged(attributes, deepClone(attributes))).toBe(false);
});
