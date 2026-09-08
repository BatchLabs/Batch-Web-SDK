import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

const VAPID = "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM";

// StandardSDK.setup() consumes the *internal* config: push activation is already
// resolved (`pushEnabled`) and push settings are flat. The public `push` →
// internal normalization is done at the public-api boundary.
function config(pushEnabled: boolean = true, overrides: Record<string, unknown> = {}): any {
  return {
    apiKey: "DEV12345",
    authKey: "1.test",
    vapidPublicKey: VAPID,
    pushEnabled,
    ...overrides,
  };
}

beforeEach(() => {
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
});

afterEach(() => {
  delete (global.navigator as any).serviceWorker;
  delete (global.window as any).PushManager;
  delete (global.window as any).Notification;
});

describe("push configuration", () => {
  it("instantiates push and the profile module by default (push omitted)", async () => {
    const sdk = new StandardSDK();
    await sdk.setup(config());

    expect(sdk["pushEnabled"]).toBe(true);
    expect(sdk["eventTracker"]).toBeDefined();
    expect(sdk["profileModule"]).toBeDefined();
  });

  it("keeps the profile module and EventTracker (Core) even when push is disabled", async () => {
    const sdk = new StandardSDK();
    await sdk.setup(config(false, { vapidPublicKey: undefined }));

    expect(sdk["eventTracker"]).toBeDefined();
    expect(sdk["profileModule"]).toBeDefined();
  });

  it("tracks events regardless of the push module (events are Core)", async () => {
    const sdk = new StandardSDK();
    await sdk.setup(config(false, { vapidPublicKey: undefined }));

    const track = jest.fn();
    sdk["eventTracker"]!.track = track as any;
    await sdk.trackEvent("custom_event");

    expect(track).toHaveBeenCalled();
  });

  describe("push disabled", () => {
    it("makes push unavailable and rejects push queries", async () => {
      const sdk = new StandardSDK();
      await sdk.setup(config(false, { vapidPublicKey: undefined }));

      expect(sdk["pushEnabled"]).toBe(false);
      expect(sdk["isPushMessagingAvailable"]()).toBe(false);
      await expect(sdk.isSubscribed()).rejects.toBeDefined();
      await expect(sdk.getSubscriptionState()).rejects.toBeDefined();
      await expect(sdk.subscribe()).rejects.toBeDefined();
    });

    it("sets up without a vapidPublicKey", async () => {
      const sdk = new StandardSDK();
      await expect(sdk.setup(config(false, { vapidPublicKey: undefined }))).resolves.toBeDefined();
    });
  });
});
