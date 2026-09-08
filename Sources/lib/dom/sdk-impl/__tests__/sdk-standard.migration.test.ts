// Migration guard for ex-Safari APNS subscribers routed to StandardSDK.
// A legacy APNS token is a plain string stored under the Subscription key; the standard
// flow stores a PushSubscription object. On start(), the string must be discarded so the
// _START event never carries it as a malformed WPP token. The lazy VAPID re-subscription
// is then carried by the `native` UI component, not by this path.
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import Event from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";

import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

const VAPID = "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM";

function config(): any {
  return { apiKey: "DEV12345", authKey: "1.test", vapidPublicKey: VAPID, pushEnabled: true };
}

// Boot a StandardSDK with `track` spied and the session cleared so start() emits _START,
// then return the token parameter carried by the emitted _START event (or undefined).
async function startAndCaptureStartToken(): Promise<unknown> {
  const track = jest.fn();
  const sdk = new StandardSDK();
  await sdk.setup(config());
  sdk["eventTracker"]!.track = track as any;

  await sdk.start();

  const startCall = track.mock.calls.find(([event]) => (event as Event).name === InternalSDKEvent.Start);
  expect(startCall).toBeDefined();
  return (startCall![0] as Event).params;
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
    value: { permission: "granted" },
    writable: true,
  });
  store = await ParameterStore.getInstance();
  await store.removeParameterValue(keysByProvider.session.SessionID);
});

afterEach(async () => {
  await store.removeParameterValue(keysByProvider.profile.Subscription);
  await store.removeParameterValue(keysByProvider.session.SessionID);
  delete (global.navigator as any).serviceWorker;
  delete (global.window as any).PushManager;
  delete (global.window as any).Notification;
});

describe("APNS → VAPID migration", () => {
  // The helper asserts the _START event was actually emitted, so a token of `null` here
  // means "emitted without the APNS token", not "never emitted" — guarding against a
  // false pass. The WPP-token-present case is covered by the characterization suite.
  it("never carries a stored APNS token in the _START event", async () => {
    await store.setParameterValue(keysByProvider.profile.Subscription, "legacy-apns-device-token");

    const params = await startAndCaptureStartToken();

    expect(params).toEqual({ token: null });
  });
});
