/* eslint-env jest */
// @ts-nocheck

import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";

import { createSDKFactory } from "../sdk-factory";
import SafariSDKFactory from "../sdk-safari";
import StandardSDKFactory from "../sdk-standard";
jest.mock("com.batch.shared/persistence/profile");

const DEFAULT_UA = window.navigator.userAgent;

const UA_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15";

// Allow to set a custom user-agent
function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    get: function () {
      return userAgent;
    },
    configurable: true,
  });
}

let store = null;

beforeAll(() => {
  return ParameterStore.getInstance().then(s => {
    store = s;
  });
});

afterEach(() => {
  setUserAgent(DEFAULT_UA);
  delete self.PushManager;
});

test("default is standard sdk factory", async () => {
  const factory = await createSDKFactory();
  expect(factory).toBe(StandardSDKFactory);
});

test("is safari sdk factory on safari 15-", async () => {
  setUserAgent(UA_SAFARI);
  const factory = await createSDKFactory();
  expect(factory).toBe(SafariSDKFactory);
});

test("is standard sdk factory on safari 16+", async () => {
  setUserAgent(UA_SAFARI);
  self.PushManager = () => {
    /** Way to mock safari 16 supporting WPP. */
  };
  const factory = await createSDKFactory();
  expect(factory).toBe(StandardSDKFactory);
});

test("is safari sdk factory on safari 16+ when user already has apns subscription", async () => {
  setUserAgent(UA_SAFARI);
  self.PushManager = () => {
    /** Way to mock safari 16 supporting WPP. */
  };
  await store.setParameterValue(keysByProvider.profile.Subscription, "faketokenapns");
  const factory = await createSDKFactory();
  expect(factory).toBe(SafariSDKFactory);
});
