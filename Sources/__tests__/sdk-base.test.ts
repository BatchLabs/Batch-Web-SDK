// @ts-nocheck

import { expect } from "@jest/globals";
jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");
jest.mock("com.batch.shared/persistence/user-data");

import BaseSdk from "com.batch.dom/sdk-impl/sdk-base";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { ProfilePersistence } from "com.batch.shared/persistence/profile";
import Session from "com.batch.shared/persistence/session";

import { TestSDK } from "../__mocks__/sdk";

const sdk = new TestSDK();

// TODO: Find a better to mock this
window.Notification = {
  permission: () => {
    return "granted";
  },
};
beforeAll(async () => {
  await sdk.setup({
    apiKey: "DEV12345",
    authKey: "1.test",
    vapidPublicKey: "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM",
  });
  await sdk.start();
});

test("is correctly instanced", () => {
  expect(sdk instanceof BaseSdk).toBe(true);
  expect(sdk.parameterStore instanceof ParameterStore).toBe(true);
  expect(sdk.parameterStore.providers.session.storage instanceof Session).toBe(true);
  expect(sdk.parameterStore.providers.profile.storage instanceof ProfilePersistence).toBe(true);
});

test("it has an install id", () => {
  return sdk.getInstallationID().then(id => {
    expect(typeof id).toBe("string");
    expect(id.length).toBe(36);
  });
});

test("it has a session id", () =>
  sdk.parameterStore.getParameterValue(keysByProvider.session.SessionID).then(val => {
    expect(typeof val).toBe("string");
    expect(val.length).toBe(36);
  }));

test("it can write and custom identifier", async () => {
  const profile = await sdk.profile();
  const profilePersistence = await ProfilePersistence.getInstance();
  await profile.identify({ customId: "test_custom_identifier" });
  const cus = await profilePersistence.getData("cus");
  expect(cus).toBe("test_custom_identifier");
  // cleaning
  await profilePersistence.removeData("cus");
});

test("trackEvent is rejected when payload exceeds 25 kB", async () => {
  // 20 string-array attributes × 25 items × 300-char strings serializes well above 25 kB
  const largeArray = Array.from({ length: 25 }, (_, i) => "a".repeat(296) + `_${String(i).padStart(3, "0")}`);
  const attrs = {};
  for (let i = 0; i < 20; i++) {
    attrs[`a${String(i).padStart(2, "0")}`] = largeArray;
  }

  const mockTrack = jest.spyOn(sdk.eventTracker, "track").mockImplementation(() => {});
  await sdk.trackEvent("oversized_event", { attributes: attrs });
  expect(mockTrack).not.toHaveBeenCalled();
  mockTrack.mockRestore();
});

test("trackEvent is accepted when payload is ~20 kB", async () => {
  // 10 string-array attributes × 25 items × 77-char strings ≈ 20 kB, well under the 25 kB limit
  const array = Array.from({ length: 25 }, (_, i) => "a".repeat(73) + `_${String(i).padStart(3, "0")}`);
  const attrs = {};
  for (let i = 0; i < 10; i++) {
    attrs[`a${String(i).padStart(2, "0")}`] = array;
  }

  const mockTrack = jest.spyOn(sdk.eventTracker, "track").mockImplementation(() => {});
  await sdk.trackEvent("valid_event", { attributes: attrs });
  expect(mockTrack).toHaveBeenCalledTimes(1);
  mockTrack.mockRestore();
});
