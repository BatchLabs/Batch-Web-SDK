/* eslint-env jest */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { SafariSDK } from "../sdk-safari";

it("tests that it filters out WPP subscriptions", () => {
  const safariSDK = new SafariSDK();

  const apnsToken = "ABCDEF";
  const wppSub = {
    endpoint: "https://batch.com/wppendpoint",
    expirationTime: 12,
    keys: {
      p256dh: "ABCDEF",
    },
  };
  expect(safariSDK["sanitizeSubscription"](apnsToken)).toEqual(apnsToken);
  expect(safariSDK["sanitizeSubscription"](wppSub)).toBeUndefined();
  expect(safariSDK["sanitizeSubscription"](2)).toBeUndefined();
  expect(safariSDK["sanitizeSubscription"](undefined)).toBeUndefined();
});
