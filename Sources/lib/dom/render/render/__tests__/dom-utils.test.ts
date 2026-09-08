/* eslint-env jest */

import {
  applyFontDecoration,
  applyHideOn,
  applyLineClamp,
  applyRadius,
  applyResponsiveBox,
  applyResponsiveLength,
  boxToCSS,
  colorToCSS,
  isTransparentColor,
  radiusToCSS,
  resolveColorPair,
  resolveHeight,
  resolveWidth,
  setResponsivePair,
  setThemePair,
} from "com.batch.dom/render/render/dom-utils";

describe("colorToCSS", () => {
  test("converts 8-digit hex to rgba", () => {
    expect(colorToCSS("#FF0000FF")).toBe("rgba(255,0,0,1.000)");
  });

  test("returns undefined for empty string", () => {
    expect(colorToCSS("")).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(colorToCSS(undefined)).toBeUndefined();
  });

  test("rounds 8-digit alpha at boundaries (FF, 80, 00)", () => {
    expect(colorToCSS("#12345680")).toBe("rgba(18,52,86,0.502)");
    expect(colorToCSS("#12345600")).toBe("rgba(18,52,86,0.000)");
    expect(colorToCSS("#123456FF")).toBe("rgba(18,52,86,1.000)");
  });

  test("normalizes a 6-digit hex missing the leading # by adding it", () => {
    expect(colorToCSS("FF0000")).toBe("#FF0000");
  });

  test("passes named colors through unchanged (no # prefix added)", () => {
    expect(colorToCSS("red")).toBe("red");
  });

  test("does not treat a 5-digit hex as a valid #RRGGBB", () => {
    expect(colorToCSS("ABCDE")).toBe("ABCDE");
  });

  test("does not treat a 7-digit hex as a valid color (anchor mutants)", () => {
    expect(colorToCSS("1234567")).toBe("1234567");
  });

  test("does not treat a 9-digit hex as an 8-digit rgba color (anchor mutants)", () => {
    expect(colorToCSS("123456789")).toBe("123456789");
  });

  test("trims surrounding whitespace before matching", () => {
    expect(colorToCSS(" #FF0000 ")).toBe("#FF0000");
    expect(colorToCSS(" #12345680 ")).toBe("rgba(18,52,86,0.502)");
  });
});

describe("isTransparentColor", () => {
  test("reads the `transparent` keyword, whatever the case and padding", () => {
    expect(isTransparentColor("transparent")).toBe(true);
    expect(isTransparentColor("  TRANSPARENT  ")).toBe(true);
  });

  test("reads the alpha of an 8-digit hex", () => {
    expect(isTransparentColor("#12345600")).toBe(true);
    expect(isTransparentColor("#00000000")).toBe(true);
    expect(isTransparentColor("#12345601")).toBe(false);
    expect(isTransparentColor("#C7C7CCFF")).toBe(false);
  });

  test("treats a 6-digit hex as opaque, black included", () => {
    expect(isTransparentColor("#000000")).toBe(false);
    expect(isTransparentColor("#FFFFFF")).toBe(false);
  });

  test("reads an explicit zero alpha out of a functional notation", () => {
    expect(isTransparentColor("rgba(0, 0, 0, 0)")).toBe(true);
    expect(isTransparentColor("rgb(1 2 3 / 0)")).toBe(true);
    expect(isTransparentColor("hsla(240, 5%, 79%, 0.0)")).toBe(true);
    expect(isTransparentColor("oklch(0.8 0.02 260 / 0%)")).toBe(true);
  });

  test("does not read a zero blue channel as a zero alpha", () => {
    expect(isTransparentColor("rgb(200, 100, 0)")).toBe(false);
    expect(isTransparentColor("rgb(200 100 0)")).toBe(false);
  });

  test("treats a painting functional notation as opaque", () => {
    expect(isTransparentColor("rgba(1, 2, 3, 0.5)")).toBe(false);
    expect(isTransparentColor("oklch(0.8 0.02 260)")).toBe(false);
    expect(isTransparentColor("color(display-p3 .8 .8 .82)")).toBe(false);
  });

  test("treats anything it cannot rule on as painting", () => {
    expect(isTransparentColor("currentcolor")).toBe(false);
    expect(isTransparentColor("red")).toBe(false);
    expect(isTransparentColor("")).toBe(false);
    expect(isTransparentColor("#ABCDE")).toBe(false);
  });
});

describe("setThemePair", () => {
  test("sets both --name and --name-dark, defaulting dark to the light value", () => {
    const el = document.createElement("div");
    setThemePair(el, "bg", "red");

    expect(el.style.getPropertyValue("--bg")).toBe("red");
    expect(el.style.getPropertyValue("--bg-dark")).toBe("red");
  });

  test("uses the dark value when provided", () => {
    const el = document.createElement("div");
    setThemePair(el, "bg", "red", "blue");

    expect(el.style.getPropertyValue("--bg")).toBe("red");
    expect(el.style.getPropertyValue("--bg-dark")).toBe("blue");
  });

  test("does not touch --name when light is undefined but still sets --name-dark", () => {
    const el = document.createElement("div");
    const setProperty = jest.spyOn(el.style, "setProperty");
    setThemePair(el, "bg", undefined, "blue");

    expect(setProperty).not.toHaveBeenCalledWith("--bg", expect.anything());
    expect(setProperty).toHaveBeenCalledWith("--bg-dark", "blue");
    expect(el.style.getPropertyValue("--bg-dark")).toBe("blue");
  });

  test("touches no variable when both light and dark are undefined", () => {
    const el = document.createElement("div");
    const setProperty = jest.spyOn(el.style, "setProperty");
    setThemePair(el, "bg", undefined, undefined);

    expect(setProperty).not.toHaveBeenCalled();
  });
});

describe("applyFontDecoration", () => {
  test("resets to normal weight/style/decoration with no flags", () => {
    const el = document.createElement("button");
    applyFontDecoration(el, []);

    expect(el.style.fontWeight).toBe("400");
    expect(el.style.fontStyle).toBe("normal");
    expect(el.style.textDecoration).toBe("none");
    expect(el.style.textDecorationLine).toBe("none");
  });

  test("applies bold and italic", () => {
    const el = document.createElement("button");
    applyFontDecoration(el, ["bold", "italic"]);

    expect(el.style.fontWeight).toBe("700");
    expect(el.style.fontStyle).toBe("italic");
  });

  test("joins multiple text decorations with a space", () => {
    const el = document.createElement("button");
    applyFontDecoration(el, ["underline", "stroke"]);

    expect(el.style.textDecoration).toBe("underline line-through");
    expect(el.style.textDecorationLine).toBe("underline line-through");
  });

  test("maps stroke alone to line-through", () => {
    const el = document.createElement("button");
    applyFontDecoration(el, ["stroke"]);

    expect(el.style.textDecoration).toBe("line-through");
  });
});

describe("resolveColorPair", () => {
  test("duplicates a single color for light and dark", () => {
    expect(resolveColorPair(["#FF0000FF"])).toEqual(["rgba(255,0,0,1.000)", "rgba(255,0,0,1.000)"]);
  });

  test("keeps distinct light and dark colors", () => {
    expect(resolveColorPair(["#FF0000FF", "#0000FFFF"])).toEqual(["rgba(255,0,0,1.000)", "rgba(0,0,255,1.000)"]);
  });

  test("falls back to provided defaults when color is undefined", () => {
    expect(resolveColorPair(undefined, "light-fallback", "dark-fallback")).toEqual(["light-fallback", "dark-fallback"]);
  });
});

describe("boxToCSS", () => {
  test("serializes box values with px units", () => {
    expect(boxToCSS([8, 16, 4, 12])).toBe("8px 16px 4px 12px");
  });

  test("returns undefined when box is undefined", () => {
    expect(boxToCSS(undefined)).toBeUndefined();
  });
});

describe("radiusToCSS", () => {
  test("serializes radius values with px units", () => {
    expect(radiusToCSS([8, 16, 4, 12])).toBe("8px 16px 4px 12px");
  });

  test("returns undefined when radius is undefined", () => {
    expect(radiusToCSS(undefined)).toBeUndefined();
  });
});

describe("resolveHeight", () => {
  test("maps fill to flex sizing", () => {
    expect(resolveHeight("fill")).toEqual({ flex: "1 1 0", minHeight: "0" });
  });

  test("maps auto to intrinsic height", () => {
    expect(resolveHeight("auto")).toEqual({ height: "auto" });
  });

  test("maps pixel heights", () => {
    expect(resolveHeight({ px: 200 })).toEqual({ height: "200px" });
    expect(resolveHeight({ px: 0 })).toEqual({ height: "0px" });
  });
});

describe("resolveWidth", () => {
  test("maps fill to full width", () => {
    expect(resolveWidth("fill")).toBe("100%");
  });

  test("maps pixel widths", () => {
    expect(resolveWidth({ px: 300 })).toBe("300px");
  });

  test("maps percent widths", () => {
    expect(resolveWidth({ percent: 50 })).toBe("50%");
    expect(resolveWidth({ percent: 100 })).toBe("100%");
  });
});

describe("applyLineClamp", () => {
  test("maxLines 0 keeps multiline text without truncation and clears the box-orient", () => {
    const el = document.createElement("p");
    applyLineClamp(el, 3);
    const removeProperty = jest.spyOn(el.style, "removeProperty");
    applyLineClamp(el, 0);

    expect(el.style.overflow).toBe("visible");
    expect(el.style.textOverflow).toBe("clip");
    expect(el.style.whiteSpace).toBe("normal");
    expect(el.style.webkitLineClamp).toBe("");
    expect(removeProperty).toHaveBeenCalledWith("-webkit-box-orient");
  });

  test("maxLines 1 applies single-line tail truncation and clears the box-orient", () => {
    const el = document.createElement("p");
    applyLineClamp(el, 3);
    const removeProperty = jest.spyOn(el.style, "removeProperty");
    applyLineClamp(el, 1);

    expect(el.style.overflow).toBe("hidden");
    expect(el.style.textOverflow).toBe("ellipsis");
    expect(el.style.whiteSpace).toBe("nowrap");
    expect(el.style.display).toBe("block");
    expect(el.style.webkitLineClamp).toBe("");
    expect(removeProperty).toHaveBeenCalledWith("-webkit-box-orient");
  });

  test("maxLines > 1 applies multi-line tail truncation", () => {
    const el = document.createElement("p");
    const setProperty = jest.spyOn(el.style, "setProperty");
    applyLineClamp(el, 3);

    expect(el.style.overflow).toBe("hidden");
    expect(el.style.textOverflow).toBe("ellipsis");
    expect(el.style.whiteSpace).toBe("normal");
    expect(el.style.display).toBe("-webkit-box");
    expect(el.style.webkitLineClamp).toBe("3");
    expect(setProperty).toHaveBeenCalledWith("-webkit-box-orient", "vertical");
  });
});

describe("applyRadius", () => {
  test("applies zero radius explicitly", () => {
    const el = document.createElement("div");
    applyRadius(el, [0, 0, 0, 0]);

    expect(el.style.borderRadius).toBe("0px 0px 0px 0px");
  });

  test("applies non-zero radius box CSS", () => {
    const el = document.createElement("div");
    applyRadius(el, [8, 8, 8, 8]);

    expect(el.style.borderRadius).toBe("8px 8px 8px 8px");
  });
});

describe("setResponsivePair", () => {
  test("always sets both variables, defaulting desktop to the base value", () => {
    const el = document.createElement("div");
    setResponsivePair(el, "iam-margin", "8px");

    expect(el.style.getPropertyValue("--iam-margin")).toBe("8px");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("8px");
  });

  test("uses the desktop value when provided", () => {
    const el = document.createElement("div");
    setResponsivePair(el, "iam-margin", "8px", "16px");

    expect(el.style.getPropertyValue("--iam-margin")).toBe("8px");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("16px");
  });

  test("does nothing when the base value is undefined", () => {
    const el = document.createElement("div");
    setResponsivePair(el, "iam-margin", undefined, "16px");

    expect(el.style.getPropertyValue("--iam-margin")).toBe("");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("");
  });
});

describe("applyResponsiveBox", () => {
  test("serializes boxes into the variable pair", () => {
    const el = document.createElement("div");
    applyResponsiveBox(el, "iam-padding", [8, 16, 8, 16], [12, 24, 12, 24]);

    expect(el.style.getPropertyValue("--iam-padding")).toBe("8px 16px 8px 16px");
    expect(el.style.getPropertyValue("--iam-padding-desktop")).toBe("12px 24px 12px 24px");
  });

  test("falls back to the base box when no desktop override exists", () => {
    const el = document.createElement("div");
    applyResponsiveBox(el, "iam-padding", [8, 16, 8, 16]);

    expect(el.style.getPropertyValue("--iam-padding-desktop")).toBe("8px 16px 8px 16px");
  });
});

describe("applyResponsiveLength", () => {
  test("serializes pixel lengths into the variable pair", () => {
    const el = document.createElement("div");
    applyResponsiveLength(el, "iam-font-size", 14, 18);

    expect(el.style.getPropertyValue("--iam-font-size")).toBe("14px");
    expect(el.style.getPropertyValue("--iam-font-size-desktop")).toBe("18px");
  });
});

describe("applyHideOn", () => {
  test("adds the matching hide class", () => {
    const mobile = document.createElement("div");
    applyHideOn(mobile, "mobile");
    expect(mobile.classList.contains("iam-hide-mobile")).toBe(true);

    const desktop = document.createElement("div");
    applyHideOn(desktop, "desktop");
    expect(desktop.classList.contains("iam-hide-desktop")).toBe(true);
  });

  test("does nothing when hideOn is undefined", () => {
    const el = document.createElement("div");
    applyHideOn(el, undefined);
    expect(el.className).toBe("");
  });
});
