/* eslint-env jest */

import type { MessageInputModel, MessageLabelModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageAnyComponentPayload, MessagePayload } from "com.batch.dom/render/model/types";
import { Log } from "com.batch.shared/logger";

function makeMessage(children: MessageAnyComponentPayload[]): MessagePayload {
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
        { type: "input", id: "email" } as unknown as MessageAnyComponentPayload,
        { type: "column", children: [] } as unknown as MessageAnyComponentPayload,
        { type: "form", children: [] } as unknown as MessageAnyComponentPayload,
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

  test("width outside (0, 100] falls back to the full width", () => {
    const message = normalizeMessage(
      makeMessage([
        { type: "field", id: "a", mapsTo: "a_map", width: 50 },
        { type: "field", id: "b", mapsTo: "b_map", width: 0 },
        { type: "field", id: "c", mapsTo: "c_map", width: 150 },
        { type: "field", id: "d", mapsTo: "d_map" },
      ])
    );

    expect(getField(message, 0).configuration.width).toBe(50);
    expect(getField(message, 1).configuration.width).toBe(100);
    expect(getField(message, 2).configuration.width).toBe(100);
    expect(getField(message, 3).configuration.width).toBe(100);
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
      makeMessage([{ type: "field", id: "a", mapsTo: "a_map", hideOn: "mobile" } as unknown as MessageAnyComponentPayload])
    );

    expect("hideOn" in getField(message)).toBe(false);
  });

  test("a stray hideOn on a field is diagnosed, but a field without it stays silent", () => {
    const debug = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    try {
      normalizeMessage(
        makeMessage([{ type: "field", id: "a", mapsTo: "a_map", hideOn: "mobile" } as unknown as MessageAnyComponentPayload])
      );
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

  test("an empty errorId is dropped", () => {
    const message = normalizeMessage(makeMessage([{ type: "field", id: "a", mapsTo: "a_map", validation: { regex: "^a$", errorId: "" } }]));

    expect(getField(message).validation).toEqual({ regex: "^a$" });
  });

  test("a non-object validation resolves to no validation model", () => {
    const message = normalizeMessage(
      makeMessage([{ type: "field", id: "a", mapsTo: "a_map", validation: "nope" as unknown as { regex?: string } }])
    );

    expect(getField(message).validation).toBeUndefined();
  });

  test("a null validation is guarded (short-circuit) and resolves to no validation model", () => {
    const message = normalizeMessage(
      makeMessage([{ type: "field", id: "a", mapsTo: "a_map", validation: null as unknown as { regex?: string } }])
    );

    expect(getField(message).validation).toBeUndefined();
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
      const message = normalizeMessage(makeMessage([payload as unknown as MessageAnyComponentPayload]));

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
