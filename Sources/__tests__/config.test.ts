/* eslint-env jest */
import { RETRY_MAX_ATTEMPTS, RETRY_MIN_INTERVAL_MS } from "../config";

test("real config is safe", () => {
  expect(RETRY_MAX_ATTEMPTS).toBe(3);
  expect(RETRY_MIN_INTERVAL_MS).toBe(1000);
});
