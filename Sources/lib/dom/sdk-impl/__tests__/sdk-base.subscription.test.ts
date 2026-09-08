import { afterEach, beforeEach, expect, it } from "@jest/globals";

import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

let swMock: {
  register: jest.Mock<any, any[]>;
};

// Setup all mocks required to minimally boot the SDK

beforeEach(() => {
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
  (swMock as any) = undefined;
  delete (global.navigator as any).serviceWorker;
  delete (global.window as any).PushManager;
  delete (global.window as any).Notification;
});

it("sanitizes the last subscription on start", async () => {
  const sdkConfig = {
    apiKey: "DEV12345",
    authKey: "1.test",
    vapidPublicKey: "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM",
  };

  const standardSDK = new StandardSDK();
  standardSDK["sanitizeSubscription"] = jest.fn();
  await standardSDK.setup(sdkConfig);
  await standardSDK.start();

  expect(standardSDK["sanitizeSubscription"]).toHaveBeenCalled();
});

it("test hasSubscriptionChanged", async () => {
  const standardSDK = new StandardSDK();
  const last = { endpoint: "testlast", expirationTime: null, keys: { p256dh: "osef", auth: "osef2" } };
  const current = { endpoint: "testcurrent", expirationTime: null, keys: { p256dh: "osef", auth: "osef2" } };
  expect(standardSDK["hasSubscriptionChanged"](last, last)).toBeFalsy();
  expect(standardSDK["hasSubscriptionChanged"](last, current)).toBeTruthy();
  expect(standardSDK["hasSubscriptionChanged"](null, current)).toBeTruthy();
  expect(standardSDK["hasSubscriptionChanged"](last, null)).toBeTruthy();
});

it("emits a single _UNSUBSCRIPTION when the permission is revoked, even across several checkUpdate() calls", async () => {
  // Regression: revoking the notification permission fires the SDK's own capteurs twice
  // (the permissions "change" event, then a "focus" event). subscriptionChanged() used to
  // persist the new "subscribed" flag without updating the in-memory lastSubscribed cache,
  // so the second checkUpdate()'s readAndCheckSubscription() re-detected the same
  // granted -> denied transition and emitted a duplicate _UNSUBSCRIPTION.
  const notification = { permission: "granted" };
  Object.defineProperty(global.window, "Notification", { configurable: true, value: notification, writable: true });

  const sub = { endpoint: "endpoint-a", expirationTime: null, keys: { p256dh: "p", auth: "a" } };

  const sdk = new StandardSDK();
  await sdk.setup({
    apiKey: "DEV12345",
    authKey: "1.test",
    vapidPublicKey: "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM",
  });

  // Fake push manager so the granted-path getSubscription() resolves to a live subscription.
  sdk["pushManager"] = { getSubscription: async () => ({ toJSON: () => sub }) } as any;

  // Prime the SDK as "subscribed while granted": persist the subscription/subscribed flag,
  // then snapshot the state so lastState/lastPermission/lastSubscribed are all consistent.
  await sdk.updateSubscription(sub, true);
  await sdk.getSubscriptionState();

  const track = jest.fn();
  sdk["eventTracker"]!.track = track as any;

  // Revoke the permission and let the two capteurs (change, then focus) both run.
  notification.permission = "denied";
  await sdk.checkUpdate();
  await sdk.checkUpdate();

  const unsubscriptions = track.mock.calls.filter(([event]: [any]) => event?.name === "_UNSUBSCRIPTION");
  expect(unsubscriptions).toHaveLength(1);
});
