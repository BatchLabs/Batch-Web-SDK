/* eslint-env jest */

import { PROFILE_ATTRIBUTE_TYPES } from "com.batch.dom/render/model/attribute-kinds";
import type { MessageInputModel, MessageLabelModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageComponentPayload, MessagePayload } from "com.batch.dom/render/model/types";
import { TEXT_FIELD_ATTRIBUTE_TYPES } from "com.batch.dom/render/test-utils/factories/attribute-type-cases";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

function makeMessage(children: MessageComponentPayload[]): MessagePayload {
  return {
    format: "modal",
    root: { children },
    closeOptions: {},
  };
}

function getField(message: ReturnType<typeof normalizeMessage>, index = 0): MessageInputModel {
  const field = message.root.children[index];
  if (field.type !== "field") {
    throw new Error(`expected a field, got "${field.type}"`);
  }
  return field;
}

/** Normalizes a single field payload and returns its model, or `null` when the normalizer dropped it. */
function normalizeField(patch: Record<string, unknown> = {}): MessageInputModel | null {
  const children = normalizeMessage(
    makeMessage([{ type: "field", id: "f", mapsTo: "f_map", ...patch } as unknown as MessageComponentPayload])
  ).root.children;
  const field = children[0];
  if (field === undefined) {
    return null;
  }
  if (field.type !== "field") {
    throw new Error(`expected a field, got "${field.type}"`);
  }
  return field;
}

describe("schema discriminants", () => {
  test("accepts the field and columns discriminants", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "email", mapsTo: "email_map" },
        { type: "columns", children: [{ type: "field", id: "phone", mapsTo: "phone_map" }] },
      ])
    );

    expect(message.root.children[0].type).toBe("field");
    const column = message.root.children[1];
    if (column.type !== "columns") throw new Error("expected column");
    expect(column.configuration.children[0]?.type).toBe("field");
  });

  test("legacy input/column/form discriminants are ignored, no node rendered", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "input", id: "email" } as unknown as MessageComponentPayload,
        { type: "column", children: [] } as unknown as MessageComponentPayload,
        { type: "form", children: [] } as unknown as MessageComponentPayload,
      ])
    );

    expect(message.root.children).toHaveLength(0);
  });
});

describe("field normalizer", () => {
  test("drops an invalid regex but keeps the field", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "email", mapsTo: "email_map", validation: { regex: "([" } }]));

    const field = getField(message);
    expect(field.validation).toBeUndefined();
  });

  test("drops a field that declares the reserved decoy mapsTo", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "trap", mapsTo: "$honeypot" },
        { type: "field", id: "email", mapsTo: "email_map" },
      ])
    );

    expect(message.root.children).toHaveLength(1);
    expect(getField(message).id).toBe("email");
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('"$honeypot" is reserved'));
    warn.mockRestore();
  });

  test("keeps errorId in the validation model", () => {
    const message = normalizeMessage(
      makeMessage([{ type: "field", id: "email", mapsTo: "email_map", validation: { errorId: "email_err" } }])
    );
    expect(getField(message).validation).toEqual({ errorId: "email_err" });
  });

  test("keeps a valid minMax pair and zero bounds mean no constraint", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", minMax: [2, 140] },
        { type: "field", id: "b", mapsTo: "b_map", minMax: [0, 300] },
        { type: "field", id: "c", mapsTo: "c_map", minMax: [0, 0] },
        { type: "field", id: "d", mapsTo: "d_map" },
      ])
    );

    expect(getField(message, 0).configuration.minLength).toBe(2);
    expect(getField(message, 0).configuration.maxLength).toBe(140);
    expect(getField(message, 1).configuration.minLength).toBeUndefined();
    expect(getField(message, 1).configuration.maxLength).toBe(300);
    expect(getField(message, 2).configuration.minLength).toBeUndefined();
    expect(getField(message, 2).configuration.maxLength).toBeUndefined();
    expect(getField(message, 3).configuration.minLength).toBeUndefined();
    expect(getField(message, 3).configuration.maxLength).toBeUndefined();
  });

  test("a typed field ignores minMax, which would bound its characters instead of its value", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "age", mapsTo: "age", attributeType: "integer", minMax: [18, 99] },
        { type: "field", id: "name", mapsTo: "name", attributeType: "string", minMax: [2, 40] },
      ])
    );

    expect(getField(message, 0).configuration).toMatchObject({ minLength: undefined, maxLength: undefined });
    expect(getField(message, 1).configuration).toMatchObject({ minLength: 2, maxLength: 40 });
  });

  test("falls back to text for an unknown fieldType", () => {
    const message = normalizeMessage(
      // @ts-expect-error invalid fieldType on purpose
      makeMessage([{ type: "field", id: "email", mapsTo: "email_map", fieldType: "weird" }])
    );

    expect(getField(message).configuration.inputType).toBe("text");
  });

  test("required defaults to false and is read from the payload", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map" },
        { type: "field", id: "b", mapsTo: "b_map", required: true },
      ])
    );

    expect(getField(message, 0).required).toBe(false);
    expect(getField(message, 1).required).toBe(true);
  });

  test("placeholderId is kept as a non-empty string and null means no placeholder", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", placeholderId: "a_ph" },
        { type: "field", id: "b", mapsTo: "b_map", placeholderId: null },
        { type: "field", id: "c", mapsTo: "c_map" },
      ])
    );

    expect(getField(message, 0).configuration.placeholderId).toBe("a_ph");
    expect(getField(message, 1).configuration.placeholderId).toBeUndefined();
    expect(getField(message, 2).configuration.placeholderId).toBeUndefined();
  });

  test.each<[string, Record<string, unknown>, number, boolean]>([
    ["a width inside the range", { width: 50 }, 50, false],
    ["a width at the accepted bound", { width: 100 }, 100, false],
    ["an absent width", {}, 100, false],
    ["a string width", { width: "50" }, 100, true],
    ["a NaN width", { width: Number.NaN }, 100, true],
    ["an infinite width", { width: Number.POSITIVE_INFINITY }, 100, true],
    ["a zero width", { width: 0 }, 100, true],
    ["a negative width", { width: -5 }, 100, true],
    ["a fractional width past the bound", { width: 100.5 }, 100, true],
    ["a width far past the bound", { width: 150 }, 100, true],
  ])("%s is normalized against the (0, 100] range", (_label, patch, expected, diagnosed) => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    try {
      expect(normalizeField(patch)?.configuration.width).toBe(expected);

      // The fallback equals the accepted bound, so only the diagnostic tells a kept width from a replaced one.
      const diagnostics = debug.mock.calls.filter(([, line]) => String(line).includes('"field.width"'));
      expect(diagnostics.length > 0).toBe(diagnosed);
    } finally {
      debug.mockRestore();
    }
  });

  test("labelFontSize defaults to 14 and labelColor falls back to the text color", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", textColor: ["#112233FF"] }]));

    const field = getField(message);
    expect(field.configuration.labelFontSize).toBe(14);
    expect(field.configuration.labelColor).toEqual(["#112233FF", "#112233FF"]);
  });

  test("label sizing overrides are honored", () => {
    const message = normalizeMessage(
      makeMessage([{ type: "field", id: "a", mapsTo: "a_map", labelFontSize: 12, labelFontSizeDesktop: 16, labelColor: ["#AABBCCFF"] }])
    );

    const field = getField(message);
    expect(field.configuration.labelFontSize).toBe(12);
    expect(field.configuration.labelFontSizeDesktop).toBe(16);
    expect(field.configuration.labelColor).toEqual(["#AABBCCFF", "#AABBCCFF"]);
  });

  test("hideOn on a field is never kept in the model", () => {
    const message = normalizeMessage(
      makeMessage([{ type: "field", id: "a", mapsTo: "a_map", hideOn: "mobile" } as unknown as MessageComponentPayload])
    );

    expect("hideOn" in getField(message)).toBe(false);
  });

  test("a stray hideOn on a field is diagnosed, but a field without it stays silent", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    try {
      normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", hideOn: "mobile" } as unknown as MessageComponentPayload]));
      expect(debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("not supported on fields"));

      debug.mockClear();
      normalizeMessage(makeMessage([{ type: "field", id: "b", mapsTo: "b_map" }]));
      expect(debug).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("not supported on fields"));
    } finally {
      debug.mockRestore();
    }
  });
});

describe("field normalizer — fieldType mapping", () => {
  test("only an invalid (defined) fieldType is diagnosed, never an absent one", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    try {
      normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", fieldType: "weird" as never }]));
      expect(debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('invalid fieldType "weird"'));

      debug.mockClear();
      normalizeMessage(makeMessage([{ type: "field", id: "b", mapsTo: "b_map" }]));
      expect(debug).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("invalid fieldType"));
    } finally {
      debug.mockRestore();
    }
  });
});

describe("field normalizer — attributeType", () => {
  test.each(TEXT_FIELD_ATTRIBUTE_TYPES)("a %s field carries its declared type", type => {
    expect(normalizeField({ attributeType: type })?.configuration.attributeType).toBe(PROFILE_ATTRIBUTE_TYPES[type]);
  });

  test.each(["boolean", "array"])("a %s field is dropped: no text control writes it", attributeType => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      expect(normalizeField({ attributeType })).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  test.each([
    ["email", "integer"],
    ["phone", "date"],
    ["email", "url"],
  ])("a %s field cannot write a %s", (fieldType, attributeType) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      expect(normalizeField({ fieldType, attributeType })).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  test.each(["integer", "float", "date", "url"])("a native slot refuses a %s: it holds a string", attributeType => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      expect(normalizeField({ mapsTo: "$email_address", attributeType })).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  test("a native slot keeps a string, declared or implied", () => {
    expect(normalizeField({ mapsTo: "$email_address", attributeType: "string" })?.mapsTo).toBe("$email_address");
    expect(normalizeField({ mapsTo: "$email_address" })?.configuration.attributeType).toBe(ProfileAttributeType.STRING);
  });

  test("the array gate runs before the fieldType gate", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      expect(normalizeField({ fieldType: "email", attributeType: "array" })).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("array"));
      expect(warn).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("email field"));
    } finally {
      warn.mockRestore();
    }
  });

  test("an unknown type falls back to string like an unknown fieldType falls back to text", () => {
    const field = normalizeField({ attributeType: "money", fieldType: "weird" });

    expect(field?.configuration.attributeType).toBe(ProfileAttributeType.STRING);
    expect(field?.configuration.inputType).toBe("text");
  });
});

describe("field normalizer — placeholderId boundary", () => {
  test("an empty-string placeholderId is dropped (length must be strictly > 0)", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", placeholderId: "" }]));

    expect(getField(message).configuration.placeholderId).toBeUndefined();
  });
});

describe("field normalizer — minMax rejects malformed pairs", () => {
  test("non-array, wrong-length, non-finite and negative entries are dropped entirely", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", minMax: 25 as unknown as number[] },
        { type: "field", id: "b", mapsTo: "b_map", minMax: [25] },
        { type: "field", id: "c", mapsTo: "c_map", minMax: [0, Infinity] },
        { type: "field", id: "d", mapsTo: "d_map", minMax: [-1, 25] },
        { type: "field", id: "e", mapsTo: "e_map", minMax: [true, 25] as unknown as number[] },
      ])
    );

    for (let i = 0; i < 5; i++) {
      expect(getField(message, i).configuration.minLength).toBeUndefined();
      expect(getField(message, i).configuration.maxLength).toBeUndefined();
    }
  });

  test("a min greater than max drops the whole pair", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", minMax: [50, 25] }]));

    expect(getField(message).configuration.minLength).toBeUndefined();
    expect(getField(message).configuration.maxLength).toBeUndefined();
  });

  test("fractional bounds are floored", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", minMax: [2.9, 25.7] }]));

    expect(getField(message).configuration.minLength).toBe(2);
    expect(getField(message).configuration.maxLength).toBe(25);
  });

  test("a min-only pair (max at zero) keeps the min constraint", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", minMax: [3, 0] }]));

    expect(getField(message).configuration.minLength).toBe(3);
    expect(getField(message).configuration.maxLength).toBeUndefined();
  });
});

describe("field normalizer — labelTextId boundary", () => {
  test("labelTextId is kept as a non-empty string; empty or null means no label", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", labelTextId: "a_label" },
        { type: "field", id: "b", mapsTo: "b_map", labelTextId: "" },
        { type: "field", id: "c", mapsTo: "c_map", labelTextId: null },
        { type: "field", id: "d", mapsTo: "d_map" },
      ])
    );

    expect(getField(message, 0).configuration.labelTextId).toBe("a_label");
    expect(getField(message, 1).configuration.labelTextId).toBeUndefined();
    expect(getField(message, 2).configuration.labelTextId).toBeUndefined();
    expect(getField(message, 3).configuration.labelTextId).toBeUndefined();
  });

  test("only a strict labelVisible false hides the label; absent or malformed stays visible", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", labelTextId: "a_label", labelVisible: false },
        { type: "field", id: "b", mapsTo: "b_map", labelTextId: "a_label", labelVisible: true },
        { type: "field", id: "c", mapsTo: "c_map", labelTextId: "a_label" },
        { type: "field", id: "d", mapsTo: "d_map", labelTextId: "a_label", labelVisible: "false" as unknown as boolean },
      ])
    );

    expect(getField(message, 0).configuration.labelVisible).toBe(false);
    expect(getField(message, 1).configuration.labelVisible).toBe(true);
    expect(getField(message, 2).configuration.labelVisible).toBe(true);
    expect(getField(message, 3).configuration.labelVisible).toBe(true);
  });
});

describe("field normalizer — validation surface", () => {
  test("required coerces any non-true value to false", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", required: "yes" as unknown as boolean },
        { type: "field", id: "b", mapsTo: "b_map", required: 1 as unknown as boolean },
        { type: "field", id: "c", mapsTo: "c_map", required: false },
      ])
    );

    expect(getField(message, 0).required).toBe(false);
    expect(getField(message, 1).required).toBe(false);
    expect(getField(message, 2).required).toBe(false);
  });

  test("a compilable regex is kept while an empty or non-string regex is dropped", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", validation: { regex: "^[0-9]+$" } },
        { type: "field", id: "b", mapsTo: "b_map", validation: { regex: "", errorId: "b_err" } },
        { type: "field", id: "c", mapsTo: "c_map", validation: { regex: 42 as unknown as string, errorId: "c_err" } },
      ])
    );

    expect(getField(message, 0).validation).toEqual({ regex: "^[0-9]+$" });
    expect(getField(message, 1).validation).toEqual({ errorId: "b_err" });
    expect(getField(message, 2).validation).toEqual({ errorId: "c_err" });
  });

  test("an invalid regex is dropped, the errorId is kept, and a warning is logged", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      const message = normalizeMessage(
        makeMessage([{ type: "field", id: "a", mapsTo: "a_map", validation: { regex: "([", errorId: "a_err" } }])
      );

      expect(getField(message).validation).toEqual({ errorId: "a_err" });
      expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("invalid regex"));
    } finally {
      warn.mockRestore();
    }
  });

  test("a regex that can backtrack exponentially is dropped, a bounded one is kept", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      const message = normalizeMessage(
        makeMessage([
          { type: "field", id: "a", mapsTo: "a_map", validation: { regex: "^(a+)+$", errorId: "a_err" } },
          { type: "field", id: "b", mapsTo: "b_map", validation: { regex: "^[0-9]{4}$" } },
        ])
      );

      expect(getField(message, 0).validation).toEqual({ errorId: "a_err" });
      expect(getField(message, 1).validation).toEqual({ regex: "^[0-9]{4}$" });
      expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("backtrack exponentially"));
    } finally {
      warn.mockRestore();
    }
  });

  test("an ambiguous repeated group is dropped whatever shape the ambiguity takes", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      const rejected = ["^(a|aa)+$", "^((a|aa))+$", "^(a?)+$", "^(?:a|aa)*$", "^(\\d|\\d\\d){2}$"];
      const kept = ["^(\\+33)+$", "^(?:ab)+$", "^(?<zone>[a-z])+$", "^(?:\\+33|0)[1-9]\\d{8}$", "^[a-z*+?{|]+$", "^a+|b+$"];

      const message = normalizeMessage(
        makeMessage(
          [...rejected, ...kept].map((regex, index) => ({
            type: "field" as const,
            id: `f${index}`,
            mapsTo: `m${index}`,
            validation: { regex, errorId: "e" },
          }))
        )
      );

      rejected.forEach((_regex, index) => expect(getField(message, index).validation).toEqual({ errorId: "e" }));
      kept.forEach((regex, index) => expect(getField(message, rejected.length + index).validation).toEqual({ regex, errorId: "e" }));
      expect(warn).toHaveBeenCalledTimes(rejected.length);
      expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("backtrack exponentially"));
    } finally {
      warn.mockRestore();
    }
  });

  test("a regex longer than the accepted bound is dropped", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      const message = normalizeMessage(
        makeMessage([{ type: "field", id: "a", mapsTo: "a_map", validation: { regex: `^[a-z]{1,${"9".repeat(200)}}$`, errorId: "a_err" } }])
      );

      expect(getField(message).validation).toEqual({ errorId: "a_err" });
      expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("longer than 200 characters"));
    } finally {
      warn.mockRestore();
    }
  });

  test("a regex at the length bound is kept, one past it is dropped", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      const atBound = `^${"a".repeat(198)}$`;
      const pastBound = `^${"a".repeat(199)}$`;

      expect(normalizeField({ validation: { regex: atBound } })?.validation).toEqual({ regex: atBound });
      expect(normalizeField({ validation: { regex: pastBound, errorId: "f_err" } })?.validation).toEqual({ errorId: "f_err" });
    } finally {
      warn.mockRestore();
    }
  });

  test("an empty errorId is dropped", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", validation: { regex: "^a$", errorId: "" } }]));

    expect(getField(message).validation).toEqual({ regex: "^a$" });
  });

  test.each<[string, unknown]>([
    ["a string", "nope"],
    ["null", null],
    ["an array", ["^a$"]],
  ])("%s validation resolves to no validation model, without throwing", (_label, validation) => {
    expect(normalizeField({ validation })?.validation).toBeUndefined();
  });
});

describe("field normalizer — ReDoS scanner", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  /** The scanner runs before `RegExp()`, so a dropped source keeps only its sibling errorId on the model. */
  function validationOf(regex: string): { regex?: string; errorId?: string } | undefined {
    return normalizeField({ validation: { regex, errorId: "e" } })?.validation;
  }

  test.each([
    ["^(a+)+$"],
    ["^(a|aa)+$"],
    // The inner alternation is promoted through the outer group, which carries the repeat.
    ["^((a|aa))+$"],
    ["^(a*)*$"],
    ["^(a?)+$"],
    // A `{n}` quantifier inside the group makes the frame ambiguous.
    ["^(a{2})+$"],
    // A `{n,}` repeat on the ambiguous group counts like `+`.
    ["^(a|b){2,}$"],
    // A non-capturing group is still a frame.
    ["^(?:a|aa)+$"],
    // Named group: the prefix must be skipped up to `>`, never further, or the group below is missed.
    ["^aaaaaaaaaa(?<n>b)(c|cc)+$"],
    // Lookbehind followed by a literal `>`: the prefix stops at `=`, it does not run to that `>`.
    ["^(?<=x)(a|aa)+>$"],
    // Unbalanced `)`: the scanner tolerates it and `RegExp()` rejects the source.
    ["^a)b$"],
    // Same with an ambiguous root frame: the scanner must not pop the root, and `RegExp()` still rejects it.
    ["^a+)b$"],
    // The class ends at `]`, so the ambiguous group after it is still scanned.
    ["^[ab](a|aa)+$"],
  ])("drops %s", regex => {
    expect(validationOf(regex)).toEqual({ errorId: "e" });
  });

  test.each([
    // The root frame is never repeated.
    ["^a+|b+$"],
    // The quantifier is inside a character class.
    ["^[a+]+$"],
    // The alternation is inside the class, so the repeated group is not ambiguous.
    ["^([a|b])+$"],
    // Escaped parentheses are literals and open no frame.
    ["^\\(a|aa\\)+$"],
    ["^\\(a\\)+$"],
    ["^(?=.*a)[a-z]+$"],
    ["^(?!x)[a-z]+$"],
    // A lookaround prefix inside a repeated group: `?`, `=` and `!` are prefix, not quantifiers.
    ["^((?=a)b)+$"],
    ["^((?!a)b)+$"],
    ["^((?<=a)b)+$"],
    ["^(?<=a)b+$"],
    // Named group: the prefix length is read from the `>` position.
    ["^(?<year>\\d{4})-\\d{2}$"],
    // `?` is not a repeat: the ambiguous group matches at most once.
    ["^(a|aa)?$"],
    // A repeated group with no inner alternation or quantifier.
    ["^(ab)+$"],
  ])("keeps %s", regex => {
    expect(validationOf(regex)).toEqual({ regex, errorId: "e" });
  });
});

describe("field normalizer — diagnostic field names", () => {
  test("an invalid width is logged with its fallback message", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    try {
      normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", width: "x" as unknown as number }]));
      expect(debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("invalid width"));
    } finally {
      debug.mockRestore();
    }
  });

  test("invalid border and text values are logged against their fully-qualified field names", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    try {
      normalizeMessage(
        makeMessage([
          { type: "field", id: "a", mapsTo: "a_map", borderWidth: "x" as unknown as number, fontSize: "y" as unknown as number },
        ])
      );
      expect(debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("field.borderWidth"));
      expect(debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("field.fontSize"));
    } finally {
      debug.mockRestore();
    }
  });
});

describe("field normalizer — mapsTo boundary", () => {
  test.each([
    ["missing", { type: "field", id: "a" }],
    ["empty", { type: "field", id: "a", mapsTo: "" }],
    ["whitespace-only", { type: "field", id: "a", mapsTo: "   " }],
  ])("drops a field whose mapsTo is %s and warns", (_label, payload) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    try {
      const message = normalizeMessage(makeMessage([payload as unknown as MessageComponentPayload]));

      expect(message.root.children).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(expect.anything(), `[normalizer] ignored field "a": missing "mapsTo"`);
    } finally {
      warn.mockRestore();
    }
  });

  test("a padded mapsTo is trimmed instead of dropped", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "  a_map  " }]));

    expect(getField(message).mapsTo).toBe("a_map");
  });
});

describe("responsive props normalization", () => {
  function getText(message: ReturnType<typeof normalizeMessage>, index = 0): MessageLabelModel {
    const text = message.root.children[index];
    if (text.type !== "text") throw new Error("expected text");
    return text;
  }

  test("marginDesktop and fontSizeDesktop are normalized on text", () => {
    const message = normalizeMessage(
      makeMessage([{ type: "text", id: "t", fontSize: 14, fontSizeDesktop: 18, color: ["#000000FF"], marginDesktop: [8, 4] }])
    );

    const text = getText(message);
    expect(text.configuration.fontStyle.fontSizeDesktop).toBe(18);
    expect(text.configuration.placement.marginDesktop).toEqual([8, 4, 8, 4]);
  });

  test("invalid desktop overrides resolve to undefined (base value everywhere)", () => {
    const message = normalizeMessage(
      makeMessage([
        {
          type: "text",
          id: "t",
          fontSize: 14,
          fontSizeDesktop: -3,
          color: ["#000000FF"],
          marginDesktop: ["a"] as unknown as number[],
        },
      ])
    );

    const text = getText(message);
    expect(text.configuration.fontStyle.fontSizeDesktop).toBeUndefined();
    expect(text.configuration.placement.marginDesktop).toBeUndefined();
  });

  test("a field paddingDesktop override keeps negative offsets, an invalid one resolves to undefined", () => {
    expect(normalizeField({ paddingDesktop: [-4, 2] })?.configuration.placement.paddingDesktop).toEqual([-4, 2, -4, 2]);
    expect(normalizeField({ paddingDesktop: ["a"] })?.configuration.placement.paddingDesktop).toBeUndefined();
  });

  test("a field padding keeps negative offsets", () => {
    expect(normalizeField({ padding: [-4, 2] })?.configuration.placement.padding).toEqual([-4, 2, -4, 2]);
  });

  test("hideOn only accepts mobile and desktop", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "text", id: "a", fontSize: 14, color: ["#000000FF"], hideOn: "mobile" },
        { type: "text", id: "b", fontSize: 14, color: ["#000000FF"], hideOn: "desktop" },
        { type: "text", id: "c", fontSize: 14, color: ["#000000FF"], hideOn: "tablet" as never },
      ])
    );

    expect(getText(message, 0).hideOn).toBe("mobile");
    expect(getText(message, 1).hideOn).toBe("desktop");
    expect(getText(message, 2).hideOn).toBeUndefined();
  });

  test("fractional column ratios are accepted", () => {
    const message = normalizeMessage(makeMessage([{ type: "columns", children: [null, null], ratios: [0.5, 0.5] }]));

    const column = message.root.children[0];
    if (column.type !== "columns") throw new Error("expected column");
    expect(column.configuration.ratios).toEqual([0.5, 0.5]);
  });

  test("root marginDesktop is normalized", () => {
    const message = normalizeMessage({
      format: "modal",
      root: { children: [], margin: [8, 8, 8, 8], marginDesktop: [24, 16, 24, 16] },
      closeOptions: {},
    });

    expect(message.root.configuration.placement.marginDesktop).toEqual([24, 16, 24, 16]);
  });
});
