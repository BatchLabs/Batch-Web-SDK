// With the 'push' module disabled, every public push method rejects with
// PUSH_MESSAGING_DISABLED (or stays neutral for reads) without reaching a push resource.
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import { PUSH_MESSAGING_DISABLED } from "../sdk-base";
import { StandardSDK } from "../sdk-standard";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

function config(overrides: Record<string, unknown> = {}): any {
  return {
    apiKey: "DEV12345",
    authKey: "1.test",
    pushEnabled: false,
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(global.window, "Notification", {
    configurable: true,
    value: { permission: "denied" },
    writable: true,
  });
});

afterEach(() => {
  delete (global.window as any).Notification;
});

describe("uniform push surface with push module disabled — StandardSDK", () => {
  let sdk: StandardSDK;
  let getPushManager: jest.SpiedFunction<StandardSDK["getPushManager"]>;

  beforeEach(async () => {
    sdk = new StandardSDK();
    await sdk.setup(config());
    getPushManager = jest.spyOn(sdk, "getPushManager");
  });

  it("rejects subscribe() with the disabled message, without reaching the push manager", async () => {
    await expect(sdk.subscribe()).rejects.toBe(PUSH_MESSAGING_DISABLED);
    expect(getPushManager).not.toHaveBeenCalled();
  });

  it("rejects unsubscribe() with the disabled message, without reaching the push manager", async () => {
    await expect(sdk.unsubscribe()).rejects.toBe(PUSH_MESSAGING_DISABLED);
    expect(getPushManager).not.toHaveBeenCalled();
  });

  it("rejects getSubscription() with the disabled message, without reaching the push manager", async () => {
    await expect(sdk.getSubscription()).rejects.toBe(PUSH_MESSAGING_DISABLED);
    expect(getPushManager).not.toHaveBeenCalled();
  });

  it("rejects isSubscribed() with the disabled message", async () => {
    await expect(sdk.isSubscribed()).rejects.toBe(PUSH_MESSAGING_DISABLED);
    expect(getPushManager).not.toHaveBeenCalled();
  });

  it("rejects getSubscriptionState() with the disabled message", async () => {
    await expect(sdk.getSubscriptionState()).rejects.toBe(PUSH_MESSAGING_DISABLED);
    expect(getPushManager).not.toHaveBeenCalled();
  });

  it("keeps refreshServiceWorkerRegistration() a no-op, without reaching the push manager", async () => {
    const initServiceWorker = jest.spyOn(sdk as any, "initServiceWorker");
    await expect(sdk.refreshServiceWorkerRegistration()).resolves.toBeUndefined();
    expect(initServiceWorker).not.toHaveBeenCalled();
    expect(getPushManager).not.toHaveBeenCalled();
  });

  it("keeps doesExistingSubscriptionKeyMatchCurrent() neutral (no key to compare)", async () => {
    await expect(sdk.doesExistingSubscriptionKeyMatchCurrent()).resolves.toBe(true);
  });

  it("keeps readPermission() reading the browser permission (non-push read)", async () => {
    await expect(sdk.readPermission()).resolves.toBe("denied");
  });
});
