/* eslint-env jest */

import { attributesOf, propCoverageGap } from "com.batch.dom/render/test-utils/prop-matrix";

describe("propCoverageGap", () => {
  const model = { name: "a case", expectModel: () => undefined };
  const css = { name: "a case", expectCss: () => undefined };

  test("accepts a property asserting both the model and the CSS", () => {
    expect(propCoverageGap({ cases: [{ ...model, ...css }] })).toBeNull();
  });

  test("accepts the two halves split across separate cases", () => {
    expect(propCoverageGap({ cases: [model, css] })).toBeNull();
  });

  test("rejects a property with no case", () => {
    expect(propCoverageGap({ cases: [] })).toBe("no case at all");
  });

  test("rejects a property whose cases never assert the model", () => {
    expect(propCoverageGap({ cases: [css] })).toBe("no case asserts the normalized model");
  });

  test("rejects a property that stops at the model", () => {
    expect(propCoverageGap({ cases: [model] })).toContain("no case asserts the CSS");
  });

  test('accepts stopping at the model only when the property declares cssExpression: "none"', () => {
    expect(propCoverageGap({ cssExpression: "none", cases: [model] })).toBeNull();
  });

  test('still requires a model assertion under cssExpression: "none"', () => {
    expect(propCoverageGap({ cssExpression: "none", cases: [css] })).toBe("no case asserts the normalized model");
  });
});

describe("attributesOf", () => {
  test("reports every attribute, including aria and data ones", () => {
    const el = document.createElement("input");
    el.type = "email";
    el.setAttribute("inputmode", "email");
    el.setAttribute("aria-required", "true");
    el.dataset.dropped = "true";
    expect(attributesOf(el)).toEqual({ type: "email", inputmode: "email", "aria-required": "true", "data-dropped": "true" });
  });

  test("an element with no attribute yields an empty object, so a bare render is assertable", () => {
    expect(attributesOf(document.createElement("input"))).toEqual({});
  });

  test("hides only the styling identity and the scope-bearing id", () => {
    const el = document.createElement("input");
    el.className = "iam-input";
    el.id = "email-a1b2c3";
    el.style.width = "100%";
    el.setAttribute("aria-describedby", "email-a1b2c3-error");
    expect(attributesOf(el)).toEqual({ "aria-describedby": "email-a1b2c3-error" });
  });

  test("keeps an attribute written from an undefined value, which is what makes a missing guard visible", () => {
    const el = document.createElement("input");
    el.setAttribute("inputmode", String(undefined));
    expect(attributesOf(el)).toEqual({ inputmode: "undefined" });
  });
});
