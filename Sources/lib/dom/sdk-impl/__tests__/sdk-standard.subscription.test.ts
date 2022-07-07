/* eslint-env jest */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { StandardSDK } from "../sdk-standard";

it("tests that it filters out APNS subscriptions", () => {
  const standardSDK = new StandardSDK();

  const apnsToken = "ABCDEF";
  const wppSub = {
    endpoint: "https://batch.com/wppendpoint",
    expirationTime: 12,
    keys: {
      p256dh: "ABCDEF",
    },
  };
  expect(standardSDK["sanitizeSubscription"](wppSub)).toEqual(wppSub);
  expect(standardSDK["sanitizeSubscription"](apnsToken)).toBeUndefined();
  expect(standardSDK["sanitizeSubscription"](2)).toBeUndefined();
  expect(standardSDK["sanitizeSubscription"](undefined)).toBeUndefined();
});
