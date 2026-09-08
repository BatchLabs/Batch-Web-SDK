import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";
import {
  addToArray,
  deduplicateKeepLast,
  isProfileStringArrayValueValid,
  isProfileStringValueValid,
  isProfileURLValueValid,
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
  describe("deduplicateKeepLast", () => {
    it("removes earlier duplicates keeping last occurrence", () => {
      expect(deduplicateKeepLast(["d", "e", "d", "a", "f", "a"])).toEqual(["e", "d", "f", "a"]);
    });

    it("returns the same array when no duplicates", () => {
      expect(deduplicateKeepLast(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    });

    it("returns empty array for empty input", () => {
      expect(deduplicateKeepLast([])).toEqual([]);
    });

    it("handles single-element arrays", () => {
      expect(deduplicateKeepLast(["a"])).toEqual(["a"]);
    });

    it("handles all-duplicate arrays", () => {
      expect(deduplicateKeepLast(["a", "a", "a"])).toEqual(["a"]);
    });
  });

  describe("isValidAttributeKey", () => {
    it("accepts valid keys", () => {
      expect(isValidAttributeKey("valid_key_123")).toBe(true);
    });

    it("rejects invalid keys", () => {
      expect(isValidAttributeKey("bad-key")).toBe(false);
      expect(isValidAttributeKey("a".repeat(31))).toBe(false);
    });
  });

  describe("isProfileStringValueValid", () => {
    it("accepts a value from 1 to the maximum length", () => {
      expect(isProfileStringValueValid("a")).toBe(true);
      expect(isProfileStringValueValid("a".repeat(Consts.AttributeStringMaxLengthCEP))).toBe(true);
    });

    it("rejects an empty value or one over the maximum length", () => {
      expect(isProfileStringValueValid("")).toBe(false);
      expect(isProfileStringValueValid("a".repeat(Consts.AttributeStringMaxLengthCEP + 1))).toBe(false);
    });
  });

  describe("isProfileStringArrayValueValid", () => {
    it("accepts 1 to the maximum number of valid entries", () => {
      expect(isProfileStringArrayValueValid(["a"])).toBe(true);
      expect(isProfileStringArrayValueValid(Array.from({ length: Consts.MaxEventArrayItems }, (_, i) => `v${i}`))).toBe(true);
    });

    it("rejects a non-array, an empty array or one over the maximum size", () => {
      expect(isProfileStringArrayValueValid("nope")).toBe(false);
      expect(isProfileStringArrayValueValid([])).toBe(false);
      expect(isProfileStringArrayValueValid(Array.from({ length: Consts.MaxEventArrayItems + 1 }, (_, i) => `v${i}`))).toBe(false);
    });

    it("rejects an array holding an invalid string entry", () => {
      expect(isProfileStringArrayValueValid(["ok", ""])).toBe(false);
      expect(isProfileStringArrayValueValid(["ok", "a".repeat(Consts.AttributeStringMaxLengthCEP + 1)])).toBe(false);
    });

    it("tolerates a non-string entry, exactly like the profile API", () => {
      expect(isProfileStringArrayValueValid(["ok", 42])).toBe(true);
      expect(isProfileStringArrayValueValid([42])).toBe(true);
      expect(isProfileStringArrayValueValid(["ok", null])).toBe(true);
    });
  });

  describe("isProfileURLValueValid", () => {
    it("accepts a serialized URL up to the maximum length", () => {
      expect(isProfileURLValueValid(new URL("https://batch.com"))).toBe(true);
      const base = "https://batch.com/";
      const exactMax = new URL(base + "a".repeat(Consts.AttributeURLMaxLength - base.length));
      expect(URL.prototype.toString.call(exactMax)).toHaveLength(Consts.AttributeURLMaxLength);
      expect(isProfileURLValueValid(exactMax)).toBe(true);
    });

    it("rejects a serialized URL over the maximum length", () => {
      const base = "https://batch.com/";
      const overMax = new URL(base + "a".repeat(Consts.AttributeURLMaxLength - base.length + 1));
      expect(isProfileURLValueValid(overMax)).toBe(false);
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

    it("keeps accepting a non-string value, as the public API always did", () => {
      expect(isValidStringValue(42 as unknown as string)).toBe(true);
    });
  });

  describe("isValidStringArrayValue", () => {
    it("accepts valid string arrays", () => {
      expect(isValidStringArrayValue(["foo", "bar"], "tags")).toBe(true);
    });

    it("rejects invalid arrays", () => {
      expect(isValidStringArrayValue([], "tags")).toBe(false);
      expect(
        isValidStringArrayValue(
          Array.from({ length: Consts.MaxEventArrayItems + 1 }, (_, i) => `v${i}`),
          "tags"
        )
      ).toBe(false);
      expect(isValidStringArrayValue([""], "tags")).toBe(false);
      expect(isValidStringArrayValue("nope" as unknown as string[], "tags")).toBe(false);
    });

    it("keeps accepting an array holding a non-string entry, as the public API always did", () => {
      expect(isValidStringArrayValue(["ok", 42] as unknown as string[], "tags")).toBe(true);
      expect(isProfileStringArrayValueValid(["ok", 42])).toBe(true);
      expect(isValidStringArrayValue(["ok", null] as unknown as string[], "tags")).toBe(true);
    });

    it("names the rejection in the warning", () => {
      const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
      try {
        isValidStringArrayValue("nope" as unknown as string[], "tags");
        isValidStringArrayValue([], "tags");
        isValidStringArrayValue([""], "tags");
        const messages = warn.mock.calls.map(call => String(call[1]));
        expect(messages[0]).toContain("must be an array of string");
        expect(messages[1]).toContain("must not be empty or longer than");
        expect(messages[2]).toContain("must only have values of type String");
        expect(messages.every(message => message.includes("tags"))).toBe(true);
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe("validateAndNormalizeTopic", () => {
    it("normalizes valid topics", () => {
      expect(validateAndNormalizeTopic("Foo_Bar")).toBe("foo_bar");
    });

    it("rejects invalid topics", () => {
      expect(() => validateAndNormalizeTopic("")).toThrow("TopicPreference value can't be empty or longer than 300 characters.");
      expect(() => validateAndNormalizeTopic("foo-bar")).toThrow("TopicPreference value must respect the following pattern: ^[a-z0-9_]+$.");
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

    it("deduplicates topics using last-wins after normalization", () => {
      expect(validateAndNormalizeTopicPreferences(["Sport", "news", "sport"])).toEqual(["news", "sport"]);
    });

    it("accepts 26 topics when one is a case-folded duplicate of another (dedup yields 25)", () => {
      const topics = Array.from({ length: 25 }, (_, i) => `topic_${i}`);
      topics.push("topic_0");
      expect(validateAndNormalizeTopicPreferences(topics)).toHaveLength(25);
      expect(validateAndNormalizeTopicPreferences(topics)[topics.length - 2]).toBe("topic_0");
    });

    it("rejects invalid arrays", () => {
      expect(() => validateAndNormalizeTopicPreferences([])).toThrow("TopicPreferences must not be empty or longer than");
      expect(() => validateAndNormalizeTopicPreferences("nope" as unknown as string[])).toThrow(
        "TopicPreferences must be an array of string."
      );
      expect(() =>
        validateAndNormalizeTopicPreferences(Array.from({ length: Consts.MaxTopicPreferenceItems + 1 }, (_, i) => `t${i}`))
      ).toThrow("TopicPreferences must not be empty or longer than");
    });
  });

  describe("validateUpdatedTopicPreferences", () => {
    it("accepts nullish values", () => {
      expect(validateUpdatedTopicPreferences(undefined)).toBe(true);
      expect(validateUpdatedTopicPreferences(null)).toBe(true);
    });

    it("validates set sizes", () => {
      expect(validateUpdatedTopicPreferences(new Set(["a", "b"]))).toBe(true);
      expect(validateUpdatedTopicPreferences(new Set(Array.from({ length: Consts.MaxTopicPreferenceItems + 1 }, (_, i) => `t${i}`)))).toBe(
        false
      );
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

    it("applies last-wins dedup when adding to an existing set", () => {
      // existing {a, b} + add [a, c] → combined ["a","b","a","c"] → last-wins → ["b","a","c"]
      const result = addToArray(["a", "c"], new Set(["a", "b"]), false) as Set<string>;
      expect([...result]).toEqual(["b", "a", "c"]);
    });

    it("adds to partial updates without mutation", () => {
      const original: PartialUpdateArrayObject = { $add: new Set(["a"]), $remove: new Set(["c"]) };
      const result = addToArray(["b"], original, false) as PartialUpdateArrayObject;

      expect(result.$add).toEqual(new Set(["a", "b"]));
      expect(result.$remove).toEqual(new Set(["c"]));
      expect(original.$add).toEqual(new Set(["a"]));
    });

    it("applies last-wins dedup when adding to a partial update $add", () => {
      // existing $add {a, b} + add [a, c] → combined ["a","b","a","c"] → last-wins → ["b","a","c"]
      const original: PartialUpdateArrayObject = { $add: new Set(["a", "b"]) };
      const result = addToArray(["a", "c"], original, false) as PartialUpdateArrayObject;
      expect([...(result.$add as Set<string>)]).toEqual(["b", "a", "c"]);
    });

    it("creates a new attribute for null or undefined", () => {
      expect(addToArray(["a"], null, false)).toEqual(new Set(["a"]));
      expect(addToArray(["a"], undefined, true)).toEqual(new Set(["a"]));
      expect(addToArray(["a"], undefined, false)).toEqual({ $add: new Set(["a"]) });
    });

    it("deduplicates values in new attributes (last-wins)", () => {
      expect([...(addToArray(["a", "b", "a"], null, false) as Set<string>)]).toEqual(["b", "a"]);
      expect([...(addToArray(["a", "b", "a"], undefined, true) as Set<string>)]).toEqual(["b", "a"]);
      const partial = addToArray(["a", "b", "a"], undefined, false) as PartialUpdateArrayObject;
      expect([...(partial.$add as Set<string>)]).toEqual(["b", "a"]);
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

    it("applies last-wins dedup when removing duplicates across calls", () => {
      // existing $remove {b} + remove [a, b, a] → combined ["b","a","b","a"] → last-wins → ["b","a"]
      // Wait: combined is ["b", "a", "b", "a"] so last-wins gives ["b", "a"] which removes earlier "b" and earlier "a"
      const original: PartialUpdateArrayObject = { $remove: new Set(["b"]) };
      const result = removeFromArray(["a", "b", "a"], original, false) as PartialUpdateArrayObject;
      expect([...(result.$remove as Set<string>)]).toEqual(["b", "a"]);
    });

    it("creates a new attribute for null or undefined", () => {
      expect(removeFromArray(["a"], null, true)).toBeNull();
      expect(removeFromArray(["a"], undefined, true)).toBeNull();
      expect(removeFromArray(["a"], undefined, false)).toEqual({ $remove: new Set(["a"]) });
    });

    it("deduplicates values in new $remove attributes (last-wins)", () => {
      const partial = removeFromArray(["a", "b", "a"], undefined, false) as PartialUpdateArrayObject;
      expect([...(partial.$remove as Set<string>)]).toEqual(["b", "a"]);
    });
  });
});
