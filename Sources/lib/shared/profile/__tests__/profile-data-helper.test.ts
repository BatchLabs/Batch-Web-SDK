import { Consts } from "com.batch.shared/constants/user";
import {
  addToArray,
  isValidAttributeKey,
  isValidStringArrayValue,
  isValidStringValue,
  removeFromArray,
  validateAndNormalizeTopicPreferences,
  validateAndNormalizeTopic,
  validateUpdatedTopicPreferences,
} from "com.batch.shared/profile/profile-data-helper";
import { PartialUpdateArrayObject } from "com.batch.shared/profile/profile-data-types";

describe("profile data helper", () => {
  describe("isValidAttributeKey", () => {
    it("accepts valid keys", () => {
      expect(isValidAttributeKey("valid_key_123")).toBe(true);
    });

    it("rejects invalid keys", () => {
      expect(isValidAttributeKey("bad-key")).toBe(false);
      expect(isValidAttributeKey("a".repeat(31))).toBe(false);
    });
  });

  describe("isValidStringValue", () => {
    it("accepts valid strings", () => {
      expect(isValidStringValue("hello")).toBe(true);
    });

    it("rejects empty or too long strings", () => {
      expect(isValidStringValue("")).toBe(false);
      expect(isValidStringValue("a".repeat(Consts.AttributeStringMaxLengthCEP + 1))).toBe(false);
    });
  });

  describe("isValidStringArrayValue", () => {
    it("accepts valid string arrays", () => {
      expect(isValidStringArrayValue(["foo", "bar"], "tags")).toBe(true);
    });

    it("rejects invalid arrays", () => {
      expect(isValidStringArrayValue([] as unknown as string[], "tags")).toBe(false);
      expect(
        isValidStringArrayValue(
          Array.from({ length: Consts.MaxEventArrayItems + 1 }, (_, i) => `v${i}`),
          "tags"
        )
      ).toBe(false);
      expect(isValidStringArrayValue([""], "tags")).toBe(false);
      expect(isValidStringArrayValue("nope" as unknown as string[], "tags")).toBe(false);
    });
  });

  describe("validateAndNormalizeTopic", () => {
    it("normalizes valid topics", () => {
      expect(validateAndNormalizeTopic("Foo_Bar")).toBe("foo_bar");
    });

    it("rejects invalid topics", () => {
      expect(() => validateAndNormalizeTopic("")).toThrow("TopicPreference value can't be empty or longer than 300 characters.");
      expect(() => validateAndNormalizeTopic("foo-bar")).toThrow(
        "TopicPreference value must respect the following pattern: ^[a-z0-9_]+$."
      );
      expect(() => validateAndNormalizeTopic("foo!")).toThrow("TopicPreference value must respect the following pattern: ^[a-z0-9_]+$.");
      expect(() => validateAndNormalizeTopic("a".repeat(Consts.TopicPreferenceMaxLength + 1))).toThrow(
        "TopicPreference value can't be empty or longer than 300 characters."
      );
    });
  });

  describe("validateAndNormalizeTopicPreferences", () => {
    it("normalizes topic arrays", () => {
      expect(validateAndNormalizeTopicPreferences(["Foo", "Bar_Baz"])).toEqual(["foo", "bar_baz"]);
    });

    it("rejects invalid arrays", () => {
      expect(() => validateAndNormalizeTopicPreferences([])).toThrow();
      expect(() => validateAndNormalizeTopicPreferences("nope" as unknown as string[])).toThrow();
      expect(() =>
        validateAndNormalizeTopicPreferences(Array.from({ length: Consts.MaxEventArrayItems + 1 }, (_, i) => `t${i}`))
      ).toThrow();
    });
  });

  describe("validateUpdatedTopicPreferences", () => {
    it("accepts nullish values", () => {
      expect(validateUpdatedTopicPreferences(undefined)).toBe(true);
      expect(validateUpdatedTopicPreferences(null)).toBe(true);
    });

    it("validates set sizes", () => {
      expect(validateUpdatedTopicPreferences(new Set(["a", "b"]))).toBe(true);
      expect(
        validateUpdatedTopicPreferences(new Set(Array.from({ length: Consts.MaxTopicPreferenceItems + 1 }, (_, i) => `t${i}`)))
      ).toBe(false);
    });

    it("validates partial update objects", () => {
      const okUpdate: PartialUpdateArrayObject = {
        $add: new Set(["a"]),
        $remove: new Set(["b"]),
      };
      const badUpdate: PartialUpdateArrayObject = {
        $add: new Set(Array.from({ length: Consts.MaxTopicPreferenceItems + 1 }, (_, i) => `t${i}`)),
      };
      expect(validateUpdatedTopicPreferences(okUpdate)).toBe(true);
      expect(validateUpdatedTopicPreferences(badUpdate)).toBe(false);
    });
  });

  describe("addToArray", () => {
    it("adds to an existing set without mutation", () => {
      const original = new Set(["a"]);
      const result = addToArray(["b", "a"], original, false) as Set<string>;

      expect(result).toEqual(new Set(["a", "b"]));
      expect(result).not.toBe(original);
      expect(original).toEqual(new Set(["a"]));
    });

    it("adds to partial updates without mutation", () => {
      const original: PartialUpdateArrayObject = { $add: new Set(["a"]), $remove: new Set(["c"]) };
      const result = addToArray(["b"], original, false) as PartialUpdateArrayObject;

      expect(result.$add).toEqual(new Set(["a", "b"]));
      expect(result.$remove).toEqual(new Set(["c"]));
      expect(original.$add).toEqual(new Set(["a"]));
    });

    it("creates a new attribute for null or undefined", () => {
      expect(addToArray(["a"], null, false)).toEqual(new Set(["a"]));
      expect(addToArray(["a"], undefined, true)).toEqual(new Set(["a"]));
      expect(addToArray(["a"], undefined, false)).toEqual({ $add: new Set(["a"]) });
    });
  });

  describe("removeFromArray", () => {
    it("removes from an existing set without mutation", () => {
      const original = new Set(["a", "b"]);
      const result = removeFromArray(["b"], original, true) as Set<string>;

      expect(result).toEqual(new Set(["a"]));
      expect(result).not.toBe(original);
      expect(original).toEqual(new Set(["a", "b"]));
    });

    it("returns null or undefined when a set becomes empty", () => {
      expect(removeFromArray(["a"], new Set(["a"]), true)).toBeNull();
      expect(removeFromArray(["a"], new Set(["a"]), false)).toBeUndefined();
    });

    it("adds to partial update objects", () => {
      const original: PartialUpdateArrayObject = { $add: new Set(["a"]), $remove: new Set(["c"]) };
      const result = removeFromArray(["b"], original, false) as PartialUpdateArrayObject;

      expect(result.$remove).toEqual(new Set(["c", "b"]));
      expect(original.$remove).toEqual(new Set(["c"]));
    });

    it("creates a new attribute for null or undefined", () => {
      expect(removeFromArray(["a"], null, true)).toBeNull();
      expect(removeFromArray(["a"], undefined, true)).toBeNull();
      expect(removeFromArray(["a"], undefined, false)).toEqual({ $remove: new Set(["a"]) });
    });
  });
});
