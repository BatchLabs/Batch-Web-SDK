/** Abort surface for the render runtime. `fetchSignal` is `undefined` in the degraded fallback, where fetch cannot be cancelled. */
export interface MessageAbortController {
  readonly signal: { readonly aborted: boolean };
  readonly fetchSignal: AbortSignal | undefined;
  abort(): void;
}

/**
 * Creates an AbortController, or an `aborted`-only fallback for Chrome <66, Firefox <57 and Safari 12.0, which stay in `.browserslistrc`
 * with no polyfill.
 */
export function createAbortController(): MessageAbortController {
  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    return {
      signal: controller.signal,
      fetchSignal: controller.signal,
      abort: () => controller.abort(),
    };
  }

  const signal = { aborted: false };
  return {
    signal,
    fetchSignal: undefined,
    abort(): void {
      signal.aborted = true;
    },
  };
}
