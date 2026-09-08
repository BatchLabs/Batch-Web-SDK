/* eslint-env jest */

import {
  normalizeBorderStyleConfiguration,
  normalizeBox,
  normalizeColor,
  normalizeFontDecoration,
  normalizeHideOn,
  normalizeHorizontalAlignment,
  normalizeMarginPlacement,
  normalizeNumber,
  normalizeOptionalBox,
  normalizeOptionalPositiveNumber,
  normalizeRadius,
  normalizeRatios,
  normalizeTextConfiguration,
  normalizeTimeInterval,
  normalizeVerticalAlignment,
  parseAspectRatio,
  parseHeight,
  parseWidth,
} from "com.batch.dom/render/model/normalize-helpers";
import { MessageColor } from "com.batch.dom/render/model/types";
import { Log } from "com.batch.shared/logger";

jest.mock("com.batch.shared/logger", () => ({
  Log: { debug: jest.fn(), warn: jest.fn() },
}));

const debugMock = Log.debug as jest.Mock;
const warnMock = Log.warn as jest.Mock;

beforeEach(() => {
  debugMock.mockClear();
  warnMock.mockClear();
});

describe("normalizeBox / expandBox", () => {
  it("expands a 1-value array to all four sides", () => {
    expect(normalizeBox([10], 5, true)).toEqual([10, 10, 10, 10]);
  });

  it("expands a 2-value array to [top/bottom, left/right] pairs", () => {
    expect(normalizeBox([10, 20], 5, true)).toEqual([10, 20, 10, 20]);
  });

  it("expands a 3-value array to [top, left/right, bottom, left/right]", () => {
    expect(normalizeBox([10, 20, 30], 5, true)).toEqual([10, 20, 30, 20]);
  });

  it("passes a 4-value array through unchanged", () => {
    expect(normalizeBox([10, 20, 30, 40], 5, true)).toEqual([10, 20, 30, 40]);
  });

  it("falls back to [fallback x4] for an empty array", () => {
    expect(normalizeBox([], 5, true)).toEqual([5, 5, 5, 5]);
  });

  it("falls back to [fallback x4] for undefined", () => {
    expect(normalizeBox(undefined, 7, true)).toEqual([7, 7, 7, 7]);
  });

  it("clamps negative values to fallback when acceptNegative is false", () => {
    expect(normalizeBox([-10, 20, -30, 40], 5, false)).toEqual([5, 20, 5, 40]);
  });

  it("keeps negative values when acceptNegative is true", () => {
    expect(normalizeBox([-10, -20, -30, -40], 5, true)).toEqual([-10, -20, -30, -40]);
  });
});

describe("normalizeRadius", () => {
  it("normalizes a 4-value radius exactly", () => {
    expect(normalizeRadius([1, 2, 3, 4], 0)).toEqual([1, 2, 3, 4]);
  });

  it("clamps negative radius values to fallback (negatives not accepted)", () => {
    expect(normalizeRadius([-5], 3)).toEqual([3, 3, 3, 3]);
  });
});

describe("normalizeNumber", () => {
  it("returns the floored value for a positive number", () => {
    expect(normalizeNumber(10.9, 0, false)).toBe(10);
  });

  it("floors negative numbers toward -Infinity when accepted", () => {
    expect(normalizeNumber(-5.1, 0, true)).toBe(-6);
  });

  it("keeps 0 as 0 (boundary, not treated as negative)", () => {
    expect(normalizeNumber(0, 99, false)).toBe(0);
  });

  it("clamps a value that floors below 0 to fallback when negatives are disallowed", () => {
    expect(normalizeNumber(-0.5, 42, false)).toBe(42);
  });

  it("returns fallback for NaN", () => {
    expect(normalizeNumber(NaN, 42, true)).toBe(42);
  });

  it("returns fallback for Infinity", () => {
    expect(normalizeNumber(Infinity, 42, true)).toBe(42);
  });

  it("returns fallback for undefined", () => {
    expect(normalizeNumber(undefined, 42, true)).toBe(42);
  });

  it("returns fallback for a non-number value", () => {
    expect(normalizeNumber("10" as unknown as number, 42, true)).toBe(42);
  });
});

describe("normalizeTimeInterval", () => {
  it("returns a positive value unchanged and un-floored", () => {
    expect(normalizeTimeInterval(5.5, 100)).toBe(5.5);
  });

  it("returns fallback for exactly 0 (strictly-positive boundary)", () => {
    expect(normalizeTimeInterval(0, 100)).toBe(100);
  });

  it("returns fallback for a negative value", () => {
    expect(normalizeTimeInterval(-5, 100)).toBe(100);
  });

  it("returns fallback for Infinity (non-finite guard, OR not AND)", () => {
    expect(normalizeTimeInterval(Infinity, 100)).toBe(100);
  });

  it("returns fallback for NaN", () => {
    expect(normalizeTimeInterval(NaN, 100)).toBe(100);
  });

  it("returns fallback for a non-number", () => {
    expect(normalizeTimeInterval("5" as unknown as number, 100)).toBe(100);
  });
});

describe("normalizeColor", () => {
  it("accepts a valid hex6 light + dark pair", () => {
    expect(normalizeColor(["#aabbcc", "#112233"], ["#ffffff", "#000000"])).toEqual(["#aabbcc", "#112233"]);
  });

  it("accepts hex8 values", () => {
    expect(normalizeColor(["#aabbccdd", "#11223344"], ["#ffffff", "#000000"])).toEqual(["#aabbccdd", "#11223344"]);
  });

  it("mirrors a valid light value into dark when dark is invalid", () => {
    expect(normalizeColor(["#aabbcc", "nope"], ["#ffffff", "#000000"])).toEqual(["#aabbcc", "#aabbcc"]);
  });

  it("mirrors a valid dark value into light when light is invalid", () => {
    expect(normalizeColor(["nope", "#112233"], ["#ffffff", "#000000"])).toEqual(["#112233", "#112233"]);
  });

  it("falls back to the provided fallback pair when both channels are invalid", () => {
    expect(normalizeColor(["nope", "nope"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("uses the literal #000000FF default when the fallback pair is also invalid", () => {
    expect(normalizeColor(undefined, ["invalid", "alsoinvalid"])).toEqual(["#000000FF", "#000000FF"]);
  });

  it("mirrors a valid fallback light into fallback dark", () => {
    expect(normalizeColor(undefined, ["#ffffff", "invalid"])).toEqual(["#ffffff", "#ffffff"]);
  });

  it("accepts transparent and currentcolor keywords", () => {
    expect(normalizeColor(["transparent", "currentcolor"], ["#ffffff", "#000000"])).toEqual(["transparent", "currentcolor"]);
  });

  it("accepts rgba functional notation", () => {
    expect(normalizeColor(["rgba(0,0,0,0.5)", "rgb(255,255,255)"], ["#ffffff", "#000000"])).toEqual([
      "rgba(0,0,0,0.5)",
      "rgb(255,255,255)",
    ]);
  });

  it("trims surrounding whitespace on a valid value", () => {
    expect(normalizeColor(["  #aabbcc  ", "  #aabbcc  "], ["#ffffff", "#000000"])).toEqual(["#aabbcc", "#aabbcc"]);
  });

  it("rejects a 7-hex-digit color (anchored length check)", () => {
    expect(normalizeColor(["#aabbccd", "#aabbccd"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("rejects a hash-prefixed color that only matches mid-string (start anchor)", () => {
    expect(normalizeColor(["##aabbcc", "##aabbcc"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("rejects a keyword with a trailing suffix (end anchor)", () => {
    expect(normalizeColor(["transparentx", "transparentx"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("rejects a keyword with a leading prefix (start anchor)", () => {
    expect(normalizeColor(["xtransparent", "xtransparent"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("rejects functional notation with a trailing suffix (end anchor)", () => {
    expect(normalizeColor(["rgb(0,0,0)x", "rgb(0,0,0)x"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("rejects functional notation with a leading prefix (start anchor)", () => {
    expect(normalizeColor(["xrgb(0,0,0)", "xrgb(0,0,0)"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("accepts a tab right after the opening paren (leading whitespace group)", () => {
    expect(normalizeColor(["rgb(\t0)", "rgb(\t0)"], ["#ffffff", "#000000"])).toEqual(["rgb(\t0)", "rgb(\t0)"]);
  });

  it("accepts a tab right before the closing paren (trailing whitespace group)", () => {
    expect(normalizeColor(["rgb(0\t)", "rgb(0\t)"], ["#ffffff", "#000000"])).toEqual(["rgb(0\t)", "rgb(0\t)"]);
  });

  it("rejects a CSS named color that is not a keyword or functional notation", () => {
    expect(normalizeColor(["red", "red"], ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });

  it("rejects a non-string channel value", () => {
    expect(normalizeColor([123 as unknown as string, "#112233"], ["#ffffff", "#000000"])).toEqual(["#112233", "#112233"]);
  });

  it("falls back when the color argument is undefined", () => {
    expect(normalizeColor(undefined, ["#ffffff", "#000000"])).toEqual(["#ffffff", "#000000"]);
  });
});

describe("parseHeight", () => {
  it("returns fallback for a non-string value", () => {
    expect(parseHeight(123 as unknown as string, "auto")).toBe("auto");
  });

  it("returns fill keyword (trimmed)", () => {
    expect(parseHeight("  fill  ", "auto")).toBe("fill");
  });

  it("returns auto keyword", () => {
    expect(parseHeight("auto", "fill")).toBe("auto");
  });

  it("parses a px value", () => {
    expect(parseHeight("10px", "auto")).toEqual({ px: 10 });
  });

  it("parses a fractional px value", () => {
    expect(parseHeight("10.5px", "auto")).toEqual({ px: 10.5 });
  });

  it("parses a px value with multiple fractional digits", () => {
    expect(parseHeight("10.55px", "auto")).toEqual({ px: 10.55 });
  });

  it("returns fallback for a non-px unit", () => {
    expect(parseHeight("10em", "auto")).toBe("auto");
  });

  it("returns fallback for a px value with a leading prefix (start anchor)", () => {
    expect(parseHeight("x10px", "auto")).toBe("auto");
  });

  it("returns fallback for a px value with a trailing suffix (end anchor)", () => {
    expect(parseHeight("10pxx", "auto")).toBe("auto");
  });
});

describe("parseWidth", () => {
  it("returns fallback for a non-string value", () => {
    expect(parseWidth(123 as unknown as string, "fill")).toBe("fill");
  });

  it("returns fill keyword (trimmed)", () => {
    expect(parseWidth("  fill  ", { px: 100 })).toBe("fill");
  });

  it("parses a px value", () => {
    expect(parseWidth("10px", "fill")).toEqual({ px: 10 });
  });

  it("parses a fractional px value", () => {
    expect(parseWidth("10.5px", "fill")).toEqual({ px: 10.5 });
  });

  it("parses a px value with multiple fractional digits", () => {
    expect(parseWidth("10.55px", "fill")).toEqual({ px: 10.55 });
  });

  it("parses a percent value", () => {
    expect(parseWidth("50%", "fill")).toEqual({ percent: 50 });
  });

  it("parses a fractional percent value", () => {
    expect(parseWidth("50.5%", "fill")).toEqual({ percent: 50.5 });
  });

  it("parses a percent value with multiple fractional digits", () => {
    expect(parseWidth("50.55%", "fill")).toEqual({ percent: 50.55 });
  });

  it("returns fallback for an invalid unit", () => {
    expect(parseWidth("10em", "fill")).toBe("fill");
  });

  it("returns fallback for a px value with a leading prefix (start anchor)", () => {
    expect(parseWidth("x10px", "fill")).toBe("fill");
  });

  it("returns fallback for a px value with a trailing suffix (end anchor)", () => {
    expect(parseWidth("10pxx", "fill")).toBe("fill");
  });

  it("returns fallback for a percent value with a leading prefix (start anchor)", () => {
    expect(parseWidth("x50%", "fill")).toBe("fill");
  });

  it("returns fallback for a percent value with a trailing suffix (end anchor)", () => {
    expect(parseWidth("50%x", "fill")).toBe("fill");
  });
});

describe("parseAspectRatio", () => {
  it("returns fit", () => {
    expect(parseAspectRatio("fit", "fill")).toBe("fit");
  });

  it("returns fill", () => {
    expect(parseAspectRatio("fill", "fit")).toBe("fill");
  });

  it("returns fallback for an invalid value", () => {
    expect(parseAspectRatio("stretch", "fit")).toBe("fit");
  });

  it("returns fallback for undefined", () => {
    expect(parseAspectRatio(undefined, "fill")).toBe("fill");
  });
});

describe("normalizeHorizontalAlignment", () => {
  it("returns left", () => {
    expect(normalizeHorizontalAlignment("left", "center")).toBe("left");
  });

  it("returns center", () => {
    expect(normalizeHorizontalAlignment("center", "left")).toBe("center");
  });

  it("returns right", () => {
    expect(normalizeHorizontalAlignment("right", "center")).toBe("right");
  });

  it("returns fallback for an invalid value", () => {
    expect(normalizeHorizontalAlignment("top" as never, "center")).toBe("center");
  });

  it("returns fallback for undefined", () => {
    expect(normalizeHorizontalAlignment(undefined, "right")).toBe("right");
  });
});

describe("normalizeVerticalAlignment", () => {
  it("returns top", () => {
    expect(normalizeVerticalAlignment("top", "center")).toBe("top");
  });

  it("returns center", () => {
    expect(normalizeVerticalAlignment("center", "top")).toBe("center");
  });

  it("returns bottom", () => {
    expect(normalizeVerticalAlignment("bottom", "center")).toBe("bottom");
  });

  it("returns fallback for an invalid value", () => {
    expect(normalizeVerticalAlignment("left" as never, "center")).toBe("center");
  });

  it("returns fallback for undefined", () => {
    expect(normalizeVerticalAlignment(undefined, "bottom")).toBe("bottom");
  });
});

describe("normalizeHideOn", () => {
  it("returns mobile", () => {
    expect(normalizeHideOn("mobile")).toBe("mobile");
  });

  it("returns desktop", () => {
    expect(normalizeHideOn("desktop")).toBe("desktop");
  });

  it("returns undefined for an invalid value", () => {
    expect(normalizeHideOn("tablet")).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(normalizeHideOn(undefined)).toBeUndefined();
  });
});

describe("normalizeFontDecoration", () => {
  it("returns [] for a non-array input", () => {
    expect(normalizeFontDecoration(undefined)).toEqual([]);
  });

  it("keeps all four valid decorations in order", () => {
    expect(normalizeFontDecoration(["bold", "italic", "underline", "stroke"])).toEqual(["bold", "italic", "underline", "stroke"]);
  });

  it("deduplicates repeated decorations", () => {
    expect(normalizeFontDecoration(["bold", "bold", "italic"])).toEqual(["bold", "italic"]);
  });

  it("drops unknown decoration values", () => {
    expect(normalizeFontDecoration(["bold", "blink"])).toEqual(["bold"]);
  });

  it("drops non-string values", () => {
    expect(normalizeFontDecoration([123 as unknown as string, "italic"])).toEqual(["italic"]);
  });
});

describe("normalizeRatios", () => {
  it("returns [] for count 0", () => {
    expect(normalizeRatios([1, 2], 0)).toEqual([]);
  });

  it("returns the provided ratios when length matches and all are positive", () => {
    expect(normalizeRatios([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  it("falls back to equal distribution when an entry is not finite (collapses to 0)", () => {
    expect(normalizeRatios([1, NaN, 3], 3)).toEqual([33, 33, 34]);
  });

  it("falls back to equal distribution when a ratio is non-positive", () => {
    expect(normalizeRatios([1, -2, 3], 3)).toEqual([33, 33, 34]);
  });

  it("falls back to equal distribution when a ratio is exactly 0 (strictly-positive check)", () => {
    expect(normalizeRatios([1, 0, 3], 3)).toEqual([33, 33, 34]);
  });

  it("falls back to equal distribution on a length mismatch", () => {
    expect(normalizeRatios([1, 2], 3)).toEqual([33, 33, 34]);
  });

  it("falls back to equal distribution when ratios are undefined", () => {
    expect(normalizeRatios(undefined, 3)).toEqual([33, 33, 34]);
  });

  it("distributes exactly across 4 columns with no remainder", () => {
    expect(normalizeRatios(undefined, 4)).toEqual([25, 25, 25, 25]);
  });
});

describe("normalizeOptionalBox", () => {
  it("returns undefined for undefined", () => {
    expect(normalizeOptionalBox(undefined, true)).toBeUndefined();
  });

  it("returns undefined for an empty array (length guard)", () => {
    expect(normalizeOptionalBox([], true)).toBeUndefined();
  });

  it("returns undefined when some entries are invalid (some, not every)", () => {
    expect(normalizeOptionalBox([1, NaN], true)).toBeUndefined();
  });

  it("normalizes a valid 2-value box with base fallback 0", () => {
    expect(normalizeOptionalBox([10, 20], true)).toEqual([10, 20, 10, 20]);
  });

  it("keeps negative values when acceptNegative is true", () => {
    expect(normalizeOptionalBox([-5], true)).toEqual([-5, -5, -5, -5]);
  });

  it("clamps negative values to 0 when acceptNegative is false", () => {
    expect(normalizeOptionalBox([-5], false)).toEqual([0, 0, 0, 0]);
  });
});

describe("normalizeOptionalPositiveNumber", () => {
  it("returns undefined for undefined", () => {
    expect(normalizeOptionalPositiveNumber(undefined)).toBeUndefined();
  });

  it("returns 0 for exactly 0 (non-negative boundary)", () => {
    expect(normalizeOptionalPositiveNumber(0)).toBe(0);
  });

  it("returns undefined for a negative value", () => {
    expect(normalizeOptionalPositiveNumber(-1)).toBeUndefined();
  });

  it("floors a positive fractional value", () => {
    expect(normalizeOptionalPositiveNumber(10.9)).toBe(10);
  });

  it("returns undefined for NaN", () => {
    expect(normalizeOptionalPositiveNumber(NaN)).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(normalizeOptionalPositiveNumber(Infinity)).toBeUndefined();
  });
});

describe("normalizeMarginPlacement", () => {
  it("keeps negative base margins (negatives accepted)", () => {
    expect(normalizeMarginPlacement([-5], 0)).toEqual({
      margin: [-5, -5, -5, -5],
      marginDesktop: undefined,
    });
  });

  it("keeps negative desktop margins (acceptNegative propagated to optional box)", () => {
    expect(normalizeMarginPlacement([0], 0, undefined, [-5])).toEqual({
      margin: [0, 0, 0, 0],
      marginDesktop: [-5, -5, -5, -5],
    });
  });

  it("resolves an invalid desktop margin to undefined", () => {
    expect(normalizeMarginPlacement([10], 0, undefined, [])).toEqual({
      margin: [10, 10, 10, 10],
      marginDesktop: undefined,
    });
  });
});

describe("normalizeBorderStyleConfiguration", () => {
  it("normalizes a full border style with exact output", () => {
    expect(
      normalizeBorderStyleConfiguration(
        { backgroundColor: ["#aabbcc", "#112233"], radius: [4], borderWidth: 2, borderColor: ["#ffffff", "#000000"] },
        { backgroundColor: ["#000000", "#ffffff"], radius: 0, borderWidth: 0, borderColor: ["#000000", "#ffffff"] },
        "test"
      )
    ).toEqual({
      backgroundColor: ["#aabbcc", "#112233"],
      radius: [4, 4, 4, 4],
      borderWidth: 2,
      borderColor: ["#ffffff", "#000000"],
    });
  });

  it("clamps a negative border width to fallback (negatives disallowed)", () => {
    expect(
      normalizeBorderStyleConfiguration(
        { borderWidth: -5 },
        { backgroundColor: ["#000000", "#000000"], radius: 0, borderWidth: 3, borderColor: ["#000000", "#000000"] },
        "test"
      ).borderWidth
    ).toBe(3);
  });
});

describe("normalizeTextConfiguration", () => {
  const defaults = {
    align: "left" as const,
    color: ["#000000", "#ffffff"] as [string, string],
    maxLines: 0,
    fontSize: 14,
  };

  it("normalizes a full text configuration with exact output", () => {
    expect(
      normalizeTextConfiguration(
        {
          align: "center",
          color: ["#aabbcc", "#112233"] as MessageColor,
          maxLines: 3,
          fontSize: 16,
          fontSizeDesktop: 20,
          fontDecoration: ["bold", "italic"],
        },
        defaults,
        "test"
      )
    ).toEqual({
      style: { align: "center", color: ["#aabbcc", "#112233"], maxLines: 3 },
      fontStyle: { fontSize: 16, fontSizeDesktop: 20, fontDecoration: ["bold", "italic"] },
    });
  });

  it("keeps negative maxLines (acceptNegative true) but clamps negative fontSize", () => {
    const result = normalizeTextConfiguration({ maxLines: -2, fontSize: -3 }, defaults, "test");
    expect(result.style.maxLines).toBe(-2);
    expect(result.fontStyle.fontSize).toBe(14);
  });

  it("drops an invalid fontSizeDesktop override to undefined", () => {
    const result = normalizeTextConfiguration({ fontSizeDesktop: -1 }, defaults, "test");
    expect(result.fontStyle.fontSizeDesktop).toBeUndefined();
  });
});

describe("normalizeOptionalBox diagnostics", () => {
  it("logs the exact message for an invalid box when a field is provided", () => {
    normalizeOptionalBox([1, NaN], true, "spacing");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] ignored "spacing": invalid box [1,null]`);
  });

  it("does not log when no field is provided", () => {
    normalizeOptionalBox([1, NaN], true);
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("normalizeOptionalPositiveNumber diagnostics", () => {
  it("logs the exact message for a negative value when a field is provided", () => {
    normalizeOptionalPositiveNumber(-1, "size");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] ignored "size": invalid number -1`);
  });

  it("does not log when no field is provided", () => {
    normalizeOptionalPositiveNumber(-1);
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("normalizeHideOn diagnostics", () => {
  it("logs the exact message for an invalid value when a field is provided", () => {
    normalizeHideOn("tablet", "hide");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] ignored "hide": invalid hideOn "tablet"`);
  });

  it("does not log when no field is provided", () => {
    normalizeHideOn("tablet");
    expect(debugMock).not.toHaveBeenCalled();
  });

  it("does not log when the value is undefined even with a field", () => {
    normalizeHideOn(undefined, "hide");
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("normalizeVerticalAlignment diagnostics", () => {
  it("logs the exact message for an invalid value when a field is provided", () => {
    normalizeVerticalAlignment("sideways" as never, "center", "valign");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "valign": invalid vertical alignment "sideways"`);
  });

  it("does not log when no field is provided", () => {
    normalizeVerticalAlignment("sideways" as never, "center");
    expect(debugMock).not.toHaveBeenCalled();
  });

  it("does not log when the value is undefined even with a field", () => {
    normalizeVerticalAlignment(undefined, "center", "valign");
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("normalizeHorizontalAlignment diagnostics", () => {
  it("logs the exact message for an invalid value when a field is provided", () => {
    normalizeHorizontalAlignment("sideways" as never, "center", "halign");
    expect(debugMock).toHaveBeenCalledWith(
      expect.anything(),
      `[normalizer] fallback for "halign": invalid horizontal alignment "sideways"`
    );
  });

  it("does not log when no field is provided", () => {
    normalizeHorizontalAlignment("sideways" as never, "center");
    expect(debugMock).not.toHaveBeenCalled();
  });

  it("does not log when the value is undefined even with a field", () => {
    normalizeHorizontalAlignment(undefined, "center", "halign");
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("parseAspectRatio diagnostics", () => {
  it("logs the exact message for an invalid value when a field is provided", () => {
    parseAspectRatio("stretch", "fit", "ar");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "ar": invalid aspect ratio "stretch"`);
  });

  it("does not log when no field is provided", () => {
    parseAspectRatio("stretch", "fit");
    expect(debugMock).not.toHaveBeenCalled();
  });

  it("does not log when the value is undefined even with a field", () => {
    parseAspectRatio(undefined, "fit", "ar");
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("parseHeight diagnostics", () => {
  it("logs the exact message for an invalid value when a field is provided", () => {
    parseHeight("10em", "auto", "height");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "height": invalid height "10em"`);
  });

  it("does not log when no field is provided", () => {
    parseHeight("10em", "auto");
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("parseWidth diagnostics", () => {
  it("logs the exact message for an invalid value when a field is provided", () => {
    parseWidth("10em", "fill", "width");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "width": invalid width "10em"`);
  });

  it("does not log when no field is provided", () => {
    parseWidth("10em", "fill");
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("normalizeColor diagnostics", () => {
  it("logs the exact message for an invalid color when a field is provided", () => {
    normalizeColor(["red", "red"], ["#ffffff", "#000000"], "col");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "col": invalid color ["red","red"]`);
  });

  it("does not log when no field is provided", () => {
    normalizeColor(["red", "red"], ["#ffffff", "#000000"]);
    expect(debugMock).not.toHaveBeenCalled();
  });

  it("does not log when the value is undefined even with a field", () => {
    normalizeColor(undefined, ["#ffffff", "#000000"], "col");
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("normalizeNumber diagnostics", () => {
  it("logs the exact message for an invalid number when a field is provided", () => {
    normalizeNumber(NaN, 0, false, "w");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "w": invalid number null`);
  });

  it("does not log for an invalid number when no field is provided", () => {
    normalizeNumber(NaN, 0, false);
    expect(debugMock).not.toHaveBeenCalled();
  });

  it("does not log for an invalid number when the value is undefined even with a field", () => {
    normalizeNumber(undefined, 0, false, "w");
    expect(debugMock).not.toHaveBeenCalled();
  });

  it("logs the exact message for a disallowed negative value when a field is provided", () => {
    normalizeNumber(-5, 0, false, "w");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "w": negative value -5 not allowed`);
  });

  it("does not log for a disallowed negative value when no field is provided", () => {
    normalizeNumber(-5, 0, false);
    expect(debugMock).not.toHaveBeenCalled();
  });
});

describe("normalizeBox diagnostics", () => {
  it("logs a per-index field name for each invalid element", () => {
    normalizeBox([NaN, NaN, NaN, NaN], 0, false, "pad");
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "pad[0]": invalid number null`);
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "pad[1]": invalid number null`);
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "pad[2]": invalid number null`);
    expect(debugMock).toHaveBeenCalledWith(expect.anything(), `[normalizer] fallback for "pad[3]": invalid number null`);
  });
});

describe("normalizeRatios diagnostics", () => {
  it("warns with the exact message when ratios are non-positive", () => {
    normalizeRatios([1, -2, 3], 3);
    expect(warnMock).toHaveBeenCalledWith(
      expect.anything(),
      `[normalizer] columns ratios ignored (non-positive values), falling back to equal distribution`
    );
  });

  it("warns with the exact message on a length mismatch", () => {
    normalizeRatios([1, 2], 3);
    expect(warnMock).toHaveBeenCalledWith(
      expect.anything(),
      `[normalizer] columns ratios length mismatch (got 2, expected 3), falling back to equal distribution`
    );
  });

  it("does not warn when ratios are undefined", () => {
    normalizeRatios(undefined, 3);
    expect(warnMock).not.toHaveBeenCalled();
  });
});
