/* eslint-env jest */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { compareUint8Array } from "../array-compare";

describe("Uint8array tests", () => {
  it("should return true when arrays are equal", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(compareUint8Array(a, b)).toBe(true);
    expect(compareUint8Array(b, a)).toBe(true);
  });

  it("should fail when arrays are not equal", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    let b = new Uint8Array([1, 2, 3, 4, 6]);
    expect(compareUint8Array(a, b)).toBe(false);
    expect(compareUint8Array(b, a)).toBe(false);

    b = new Uint8Array([1, 2, 3, 4, 5, 6]);
    expect(compareUint8Array(a, b)).toBe(false);
    expect(compareUint8Array(b, a)).toBe(false);

    b = new Uint8Array([1, 2, 3, 4]);
    expect(compareUint8Array(a, b)).toBe(false);
    expect(compareUint8Array(b, a)).toBe(false);

    b = new Uint8Array([]);
    expect(compareUint8Array(a, b)).toBe(false);
    expect(compareUint8Array(b, a)).toBe(false);

    b = new Uint8Array([2]);
    expect(compareUint8Array(a, b)).toBe(false);
    expect(compareUint8Array(b, a)).toBe(false);
  });
});
