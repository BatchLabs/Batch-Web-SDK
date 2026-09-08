/**
 * @jest-environment node
 */
/* eslint-env jest */

import { resolveScheme } from "com.batch.dom/render/runtime/theme-resolver";

describe("resolveScheme (no window)", () => {
  test("returns 'light' when window is undefined", () => {
    expect(typeof window).toBe("undefined");
    expect(resolveScheme()).toBe("light");
  });
});
