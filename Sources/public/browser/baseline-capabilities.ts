/** True when the global `Promise` is the engine's, not a polyfill or a wrapper. */
export function isNativePromise(): boolean {
  return Promise.toString().indexOf("[native code]") !== -1;
}

/** Fail-closed capability gate: returns false when the browser cannot run the SDK. */
export function assertBaselineCapabilities(report: (message: string) => void, options?: { allowNonNativePromises?: boolean }): boolean {
  if (!self.fetch) {
    report("[Batch] 'fetch' is missing on self, refusing to load.");
    return false;
  }
  if (typeof Promise === "undefined") {
    report("[Batch] Promises aren't available, refusing to load.");
    return false;
  }
  if (!isNativePromise() && options?.allowNonNativePromises !== true) {
    report("[Batch] Using non-standard Promises, refusing to load.");
    return false;
  }
  if (!URL || URL.prototype.toString.call(new URL("https://batch.com")) !== "https://batch.com/") {
    report("[Batch] URL is unreliable, refusing to load.");
    return false;
  }
  return true;
}
