// Characterization guard for the standard push flow (VAPID / WPP), captured before
// the Safari APNS removal. Once StandardSDK becomes the only implementation, these
// contracts must keep the same result: setup, the WPP token shape exposed to events,
// and how a stored subscription is loaded on start().
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";

import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

const VAPID = "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM";

const WPP_SUBSCRIPTION = {
  endpoint: "https://batch.com/wppendpoint",
  expirationTime: null,
  keys: { p256dh: "p256", auth: "auth" },
};

function config(): any {
  return {
    apiKey: "DEV12345",
    authKey: "1.test",
    vapidPublicKey: VAPID,
    pushEnabled: true,
  };
}

let store: ParameterStore;

beforeEach(async () => {
  Object.defineProperty(global.navigator, "serviceWorker", {
    configurable: true,
    value: { register: jest.fn() },
    writable: true,
  });
  Object.defineProperty(global.window, "PushManager", { configurable: true, value: {}, writable: true });
  Object.defineProperty(global.window, "Notification", {
    configurable: true,
    value: { permission: "denied" },
    writable: true,
  });
  store = await ParameterStore.getInstance();
});

afterEach(async () => {
  await store.removeParameterValue(keysByProvider.profile.Subscription);
  await store.removeParameterValue(keysByProvider.profile.Subscribed);
  delete (global.navigator as any).serviceWorker;
  delete (global.window as any).PushManager;
  delete (global.window as any).Notification;
});

describe("standard push flow — characterization", () => {
  it("exposes no event token when no subscription is stored", async () => {
    const sdk = new StandardSDK();
    await sdk.setup(config());
    await sdk.start();

    expect(sdk.getTokenForEventParameter()).toBeNull();
  });

  it("exposes a WPP token for a stored WPP subscription", async () => {
    await store.setParameterValue(keysByProvider.profile.Subscription, WPP_SUBSCRIPTION);

    const sdk = new StandardSDK();
    await sdk.setup(config());
    await sdk.start();

    expect(sdk.getTokenForEventParameter()).toEqual({
      protocol: "WPP",
      subscription: WPP_SUBSCRIPTION,
    });
  });
});
