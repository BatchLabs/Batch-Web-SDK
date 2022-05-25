import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { UserAttributeType } from "com.batch.shared/user/user-attribute-editor";
import { hasUserDataChanged } from "com.batch.shared/user/user-data-diff";
import { UserDataAttributes, UserDataTagCollections } from "com.batch.shared/user/user-data-writer";

it("returns a change on different attributes", () => {
  const oldAttributes: UserDataAttributes = {
    foobar: {
      type: UserAttributeType.INTEGER,
      value: 26,
    },
    os: {
      type: UserAttributeType.STRING,
      value: "linux",
    },
  };
  const oldAttributesSnapshot = deepClone(oldAttributes);

  const attribute1: UserDataAttributes = {
    foobar: {
      type: UserAttributeType.INTEGER,
      value: 27,
    },
    os: {
      type: UserAttributeType.STRING,
      value: "linux",
    },
  };

  const attribute2: UserDataAttributes = {
    foobar: {
      type: UserAttributeType.STRING,
      value: "27",
    },
    os: {
      type: UserAttributeType.STRING,
      value: "linux",
    },
  };

  const attribute3: UserDataAttributes = {
    os: {
      type: UserAttributeType.STRING,
      value: "linux",
    },
  };

  const attribute4: UserDataAttributes = {
    os: {
      type: UserAttributeType.STRING,
      value: "test",
    },
  };

  const attribute5: UserDataAttributes = {
    test: {
      type: UserAttributeType.STRING,
      value: "test",
    },
  };

  const attribute6: UserDataAttributes = {};

  expect(hasUserDataChanged(oldAttributes, {}, attribute1, {})).toBe(true);
  expect(hasUserDataChanged(oldAttributes, {}, attribute2, {})).toBe(true);
  expect(hasUserDataChanged(oldAttributes, {}, attribute3, {})).toBe(true);
  expect(hasUserDataChanged(oldAttributes, {}, attribute4, {})).toBe(true);
  expect(hasUserDataChanged(oldAttributes, {}, attribute5, {})).toBe(true);
  expect(hasUserDataChanged(oldAttributes, {}, attribute6, {})).toBe(true);
  expect(hasUserDataChanged(attribute6, {}, oldAttributes, {})).toBe(true);

  // Make sure that the data didn't get mutated
  expect(oldAttributes).toEqual(oldAttributesSnapshot);
});

it("returns a change on different tags", () => {
  const oldTags: UserDataTagCollections = {
    foobar: ["bar", "baz"],
    os: ["linux"],
  };
  const oldTagsSnapshot = deepClone(oldTags);

  const newTags1: UserDataTagCollections = {
    editor: ["vim"],
  };
  const newTags2: UserDataTagCollections = {
    foobar: ["bar", "baz", "bap"],
    os: ["linux"],
  };
  const newTags3: UserDataTagCollections = {
    foobar: ["bar"],
    os: ["linux"],
  };
  const newTags4: UserDataTagCollections = {
    foobar: ["bar"],
    os: ["linux"],
  };
  const newTags5: UserDataTagCollections = {
    foobar: ["bar", "baz"],
  };
  const newTags6: UserDataTagCollections = {};

  expect(hasUserDataChanged({}, oldTags, {}, newTags1)).toBe(true);
  expect(hasUserDataChanged({}, oldTags, {}, newTags2)).toBe(true);
  expect(hasUserDataChanged({}, oldTags, {}, newTags3)).toBe(true);
  expect(hasUserDataChanged({}, oldTags, {}, newTags4)).toBe(true);
  expect(hasUserDataChanged({}, oldTags, {}, newTags5)).toBe(true);
  expect(hasUserDataChanged({}, oldTags, {}, newTags6)).toBe(true);
  expect(hasUserDataChanged({}, newTags6, {}, oldTags)).toBe(true);

  // Make sure that the data didn't get mutated
  expect(oldTags).toEqual(oldTagsSnapshot);
});

it("returns no change on same attributes", () => {
  expect(hasUserDataChanged({}, {}, {}, {})).toBe(false);

  const attributes: UserDataAttributes = {
    foobar: {
      type: UserAttributeType.INTEGER,
      value: 26,
    },
    os: {
      type: UserAttributeType.STRING,
      value: "linux",
    },
  };

  expect(hasUserDataChanged(attributes, {}, deepClone(attributes), {})).toBe(false);
});

it("returns no change same tags", () => {
  const tags: UserDataTagCollections = {
    foobar: ["bar", "baz"],
    os: ["linux"],
  };

  expect(hasUserDataChanged({}, tags, {}, deepClone(tags))).toBe(false);
});

it("returns no change same tags and attributes", () => {
  const tags: UserDataTagCollections = {
    foobar: ["bar", "baz"],
  };

  const attributes: UserDataAttributes = {
    foobar: {
      type: UserAttributeType.INTEGER,
      value: 26,
    },
    os: {
      type: UserAttributeType.STRING,
      value: "linux",
    },
  };

  expect(hasUserDataChanged(attributes, tags, deepClone(attributes), deepClone(tags))).toBe(false);
});
