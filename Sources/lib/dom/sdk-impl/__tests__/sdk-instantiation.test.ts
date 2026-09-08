// Replaces the former sdk-factory selection tests. There is no longer a runtime factory
// branching on the user agent: the public API always instantiates StandardSDK, and push
// availability is decided purely by the `PushManager` feature check — never by the UA.
// This locks in the contract that replaced the old Safari-15-vs-16 factory branch:
//   Safari 16+ (PushManager present) → standard push path; Safari < 16 → no push, cleanly.
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

const VAPID = "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM";
const DEFAULT_UA = window.navigator.userAgent;
const UA_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", { get: () => userAgent, configurable: true });
}

function config(): any {
  return { apiKey: "DEV12345", authKey: "1.test", vapidPublicKey: VAPID, pushEnabled: true };
}

beforeEach(() => {
  Object.defineProperty(global.navigator, "serviceWorker", { configurable: true, value: { register: jest.fn() }, writable: true });
  Object.defineProperty(global.window, "Notification", { configurable: true, value: { permission: "denied" }, writable: true });
});

afterEach(() => {
  setUserAgent(DEFAULT_UA);
  delete (global.navigator as any).serviceWorker;
  delete (global.window as any).PushManager;
  delete (global.window as any).Notification;
});

describe("SDK push availability — feature check, not user agent", () => {
  it("routes Safari 16+ (PushManager present) through the standard push path", async () => {
    setUserAgent(UA_SAFARI);
    Object.defineProperty(global.window, "PushManager", { configurable: true, value: {}, writable: true });

    const sdk = new StandardSDK();
    await sdk.setup(config());

    expect(sdk["isPushMessagingAvailable"]()).toBe(true);
  });

  it("leaves Safari < 16 (no PushManager) without push, and setup still succeeds", async () => {
    setUserAgent(UA_SAFARI);
    // No PushManager on window: emulates Safari < 16.

    const sdk = new StandardSDK();
    await expect(sdk.setup(config())).resolves.toBeDefined();

    expect(sdk["isPushMessagingAvailable"]()).toBe(false);
  });

  it("keys availability off PushManager regardless of the user agent", async () => {
    // Same PushManager state, different UA → same availability: the UA does not gate push.
    Object.defineProperty(global.window, "PushManager", { configurable: true, value: {}, writable: true });

    setUserAgent(UA_SAFARI);
    const safariSdk = new StandardSDK();
    await safariSdk.setup(config());

    setUserAgent(DEFAULT_UA);
    const otherSdk = new StandardSDK();
    await otherSdk.setup(config());

    expect(safariSdk["isPushMessagingAvailable"]()).toBe(otherSdk["isPushMessagingAvailable"]());
    expect(safariSdk["isPushMessagingAvailable"]()).toBe(true);
  });
});
