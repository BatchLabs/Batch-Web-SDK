/* eslint-env jest */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { SafariSDK } from "../sdk-safari";
import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

let safariMock;
let swMock: {
  register: jest.Mock<any, any[]>;
};

// Setup all mocks required to minimally boot the SDK

beforeEach(() => {
  safariMock = {
    pushNotification: {
      permission: jest.fn().mockReturnValue({
        permission: "deined",
      }) as any,
    },
  };
  Object.defineProperty(global.window, "safari", {
    configurable: true,
    value: safariMock,
    writable: true,
  });

  // JSDOM doesn't support service workers
  swMock = {
    register: jest.fn() as any,
  };
  Object.defineProperty(global.navigator, "serviceWorker", {
    configurable: true,
    value: swMock,
    writable: true,
  });
  Object.defineProperty(global.window, "PushManager", {
    configurable: true,
    value: {},
    writable: true,
  });
  Object.defineProperty(global.window, "Notification", {
    configurable: true,
    value: {
      permission: () => {
        return "denied";
      },
    },
    writable: true,
  });
});

afterEach(() => {
  (safariMock as any) = undefined;
  delete (global.window as any).safari;
  (swMock as any) = undefined;
  delete (global.navigator as any).serviceWorker;
  delete (global.window as any).PushManager;
  delete (global.window as any).Notification;
});

it("sanitizes the last subscription on start", async () => {
  const sdkConfig = {
    apiKey: "DEV12345",
    subdomain: "webpush",
    authKey: "1.test",
    vapidPublicKey: "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM",
    safari: {
      "http://localhost": "web.test",
    },
  };

  const standardSDK = new StandardSDK();
  standardSDK["sanitizeSubscription"] = jest.fn();
  await standardSDK.setup(sdkConfig);
  await standardSDK.start();

  expect(standardSDK["sanitizeSubscription"]).toHaveBeenCalled();

  const safariSDK = new SafariSDK();
  safariSDK["sanitizeSubscription"] = jest.fn();
  await safariSDK.setup(sdkConfig);
  await safariSDK.start();

  expect(safariSDK["sanitizeSubscription"]).toHaveBeenCalled();
});

it("test hasSubscriptionChanged", async () => {
  const standardSDK = new StandardSDK();
  const last = {"endpoint":"testlast","expirationTime":null,"keys":{"p256dh":"osef","auth":"osef2"}}
  const current = {"endpoint":"testcurrent","expirationTime":null,"keys":{"p256dh":"osef","auth":"osef2"}}
  expect(standardSDK["hasSubscriptionChanged"](last, last)).toBeFalsy()
  expect(standardSDK["hasSubscriptionChanged"](last, current)).toBeTruthy()
  expect(standardSDK["hasSubscriptionChanged"](null, current)).toBeTruthy()
  expect(standardSDK["hasSubscriptionChanged"](last, null)).toBeTruthy()
});
