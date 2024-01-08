/**
 * Returns a promise that resolves itself after a duration (miliseconds)
 */
export function Delay(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration));
}

/**
 * Returns a promise that failed after a duration (miliseconds)
 */
export function Timeout(duration: number): Promise<void> {
  return Delay(duration).then(() => Promise.reject("Timed out after " + duration + "ms"));
}
