/* eslint-env jest */

import { resolveScheme } from "com.batch.dom/render/runtime/theme-resolver";

describe("resolveScheme", () => {
  function withMatchMedia<T>(impl: ((query: string) => { matches: boolean }) | undefined, run: () => T): T {
    const descriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", { value: impl, configurable: true, writable: true });
    try {
      return run();
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "matchMedia", descriptor);
      } else {
        delete (window as unknown as { matchMedia?: unknown }).matchMedia;
      }
    }
  }

  test("returns 'dark' and queries prefers-color-scheme when the media query matches", () => {
    const matchMedia = jest.fn().mockReturnValue({ matches: true });

    const scheme = withMatchMedia(matchMedia, () => resolveScheme());

    expect(scheme).toBe("dark");
    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  test("returns 'light' when the media query does not match", () => {
    const matchMedia = jest.fn().mockReturnValue({ matches: false });

    const scheme = withMatchMedia(matchMedia, () => resolveScheme());

    expect(scheme).toBe("light");
  });

  test("returns 'light' when matchMedia is not a function", () => {
    const scheme = withMatchMedia(undefined, () => resolveScheme());

    expect(scheme).toBe("light");
  });
});
