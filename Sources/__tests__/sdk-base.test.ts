/* eslint-env jest */
// @ts-nocheck

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

import BaseSdk from "com.batch.dom/sdk-impl/sdk-base";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { ProfilePersistence } from "com.batch.shared/persistence/profile";
import Session from "com.batch.shared/persistence/session";

const sdk = new BaseSdk();

// TODO: Find a better to mock this
window.Notification = {
  permission: () => {
    return "granted";
  },
};

beforeAll(async () => {
  await sdk.setup({
    apiKey: "DEV12345",
    subdomain: "webpush",
    authKey: "1.test",
    vapidPublicKey: "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM",
  });
  await sdk.start();
});

test("is correctly isntancied", () => {
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

test("it can write and read a custom identifier", done => {
  sdk.setCustomUserID("toto").then(resp => {
    expect(resp).toBe("toto");
    sdk.getCustomUserID().then(nextVal => {
      expect(nextVal).toBe("toto");
      done();
    });
  });
});
