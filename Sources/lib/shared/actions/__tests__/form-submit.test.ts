/* eslint-env jest */

import { isFormSubmitAction } from "com.batch.shared/actions/form-submit";

describe("isFormSubmitAction", () => {
  test("matches batch.form.submit itself, case-insensitively", () => {
    expect(isFormSubmitAction("batch.form.submit", undefined)).toBe(true);
    expect(isFormSubmitAction(" Batch.Form.Submit ", {})).toBe(true);
  });

  test("matches a batch.group that chains the submit with a redirect", () => {
    expect(
      isFormSubmitAction("batch.group", {
        actions: [
          ["batch.form.submit", {}],
          ["batch.deeplink", { l: "https://batch.com", li: true }],
        ],
      })
    ).toBe(true);
    expect(isFormSubmitAction("batch.group", { actions: [{ action: "batch.form.submit", params: {} }] })).toBe(true);
  });

  test("rejects other actions and groups without a submit", () => {
    expect(isFormSubmitAction("batch.deeplink", { l: "https://batch.com" })).toBe(false);
    expect(
      isFormSubmitAction("batch.group", {
        actions: [
          ["batch.clipboard", { t: "x" }],
          ["batch.deeplink", { l: "https://batch.com" }],
        ],
      })
    ).toBe(false);
    expect(isFormSubmitAction("batch.group", {})).toBe(false);
    expect(isFormSubmitAction(undefined, undefined)).toBe(false);
  });
});
