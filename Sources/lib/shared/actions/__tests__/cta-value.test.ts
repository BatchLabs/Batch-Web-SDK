/* eslint-env jest */

import { resolveCTAValue } from "../resolve/cta-value";

describe("resolveCTAValue", () => {
  test("reports the deeplink URL from its `l` arg", () => {
    expect(resolveCTAValue("batch.deeplink", { l: "https://batch.com/offer", li: true })).toBe("https://batch.com/offer");
  });

  test("reports the deeplink URL as declared, even when the handler would refuse it as unsafe", () => {
    expect(resolveCTAValue("batch.deeplink", { l: "javascript:alert(1)" })).toBe("javascript:alert(1)");
  });

  test.each([
    ["the short arg", { t: "PROMO2024" }],
    ["the long arg", { text: "PROMO2024" }],
  ])("reports the clipboard text from %s", (_label, args) => {
    expect(resolveCTAValue("batch.clipboard", args)).toBe("PROMO2024");
  });

  test("prefers the short clipboard arg, as the handler does", () => {
    expect(resolveCTAValue("batch.clipboard", { t: "short", text: "long" })).toBe("short");
  });

  test.each([
    ["a group, whose payload is a list", "batch.group", { actions: [["batch.dismiss"]] }],
    ["a user tag, whose payload is a triplet", "batch.user.tag", { a: "add", c: "interests", t: "sports" }],
    ["a form submit, whose value comes from the collected fields", "batch.form.submit", { e: "lead" }],
    ["an unknown action", "customer.custom", { l: "https://batch.com" }],
  ])("reports nothing for %s", (_label, action, args) => {
    expect(resolveCTAValue(action, args)).toBeUndefined();
  });

  test("reports nothing for a CTA that carries no action at all", () => {
    expect(resolveCTAValue(undefined, undefined)).toBeUndefined();
  });

  test("reports nothing when the declared arg is missing or not a string", () => {
    expect(resolveCTAValue("batch.deeplink", {})).toBeUndefined();
    expect(resolveCTAValue("batch.deeplink", { l: 42 })).toBeUndefined();
  });

  test.each([
    ["a padded, uppercased deeplink", " BATCH.DEEPLINK ", { l: "https://batch.com/offer" }, "https://batch.com/offer"],
    ["a mixed-case clipboard", "Batch.Clipboard", { t: "PROMO2024" }, "PROMO2024"],
  ])("resolves %s, like the registry does", (_label, action, args, expected) => {
    expect(resolveCTAValue(action, args)).toBe(expected);
  });
});
