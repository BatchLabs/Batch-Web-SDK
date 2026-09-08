/* eslint-env jest */
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

const VAPID = "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM";

beforeEach(() => {
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
});

afterEach(() => {
  delete (global.navigator as any).serviceWorker;
  delete (global.window as any).PushManager;
  delete (global.window as any).Notification;
});

// Boot the SDK far enough to have a parameter store, event tracker and decoded pubKey.
// The service worker mock has no `ready`, so pushManager stays unset and we inject our own.
async function bootSDK(): Promise<StandardSDK> {
  const sdk = new StandardSDK();
  await sdk.setup({ apiKey: "DEV12345", authKey: "1.test", vapidPublicKey: VAPID });
  return sdk;
}

function subJSON(endpoint: string): PushSubscriptionJSON {
  return { endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } };
}

describe("StandardSDK.subscribe idempotency", () => {
  it("coalesces concurrent subscribe() calls into a single native subscription", async () => {
    const sdk = await bootSDK();

    // Emulate the browser: no subscription yet, subscribe() mints and registers one.
    let current: unknown = null;
    const created = { toJSON: () => subJSON("endpoint-created") };
    const subscribeMock = jest.fn(async () => {
      current = created;
      return created;
    });
    const getSubscriptionMock = jest.fn(async () => current);
    sdk["pushManager"] = { getSubscription: getSubscriptionMock, subscribe: subscribeMock } as any;

    const [a, b, c] = await Promise.all([sdk.subscribe(), sdk.subscribe(), sdk.subscribe()]);

    // The three racing callers must not each mint an endpoint.
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(true);
  });

  it("reuses an existing subscription with a matching key instead of re-subscribing", async () => {
    const sdk = await bootSDK();

    const existing = {
      options: { applicationServerKey: sdk["pubKey"] },
      toJSON: () => subJSON("endpoint-existing"),
    };
    const subscribeMock = jest.fn();
    sdk["pushManager"] = { getSubscription: jest.fn(async () => existing), subscribe: subscribeMock } as any;

    const result = await sdk.subscribe();

    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("unsubscribes a stale subscription then re-subscribes when the key does not match", async () => {
    const sdk = await bootSDK();

    // Real browsers reject subscribe() while a subscription with a different key still exists,
    // so the stale one must be unsubscribed first (e.g. after a VAPID key rotation).
    let current: any = null;
    const created = { options: { applicationServerKey: sdk["pubKey"] }, toJSON: () => subJSON("endpoint-rotated") };
    const unsubscribeMock = jest.fn(async () => {
      current = null;
      return true;
    });
    current = {
      options: { applicationServerKey: new Uint8Array([1, 2, 3]) },
      unsubscribe: unsubscribeMock,
      toJSON: () => subJSON("endpoint-stale"),
    };
    const subscribeMock = jest.fn(async () => {
      if (current) {
        throw new DOMException("a subscription with a different key exists", "InvalidStateError");
      }
      current = created;
      return created;
    });
    sdk["pushManager"] = { getSubscription: jest.fn(async () => current), subscribe: subscribeMock } as any;

    const result = await sdk.subscribe();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it("reuses the subscription on a fresh call once the previous in-flight one settled", async () => {
    const sdk = await bootSDK();

    let current: any = null;
    const created = { options: { applicationServerKey: sdk["pubKey"] }, toJSON: () => subJSON("endpoint-created") };
    const subscribeMock = jest.fn(async () => {
      current = created;
      return created;
    });
    sdk["pushManager"] = { getSubscription: jest.fn(async () => current), subscribe: subscribeMock } as any;

    const first = await sdk.subscribe();
    const second = await sdk.subscribe(); // lock cleared: this one finds the matching sub and reuses it

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });
});
