// @ts-nocheck

jest.mock("com.batch.shared/persistence/profile");

import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";

let store = null;

beforeAll(async () => {
  store = await ParameterStore.getInstance();
});

test("can get a single param", async () => {
  expect(typeof (await store.getParameterValue(keysByProvider.system.DeviceDate))).toBe("string");
});

test("can get multiple params", async () => {
  const response = await store.getParametersValues([keysByProvider.system.DeviceDate, keysByProvider.system.DeviceTimezone]);

  expect(typeof response.da).toBe("string");
  expect(typeof response.dtz).toBe("string");
});

test("can write a param, and get the same value", async () => {
  await store.setParameterValue(keysByProvider.profile.CustomIdentifier, "michel@batch.com");

  const sameInstance = await ParameterStore.getInstance("memory");
  expect(sameInstance).toBe(store);
  expect(await sameInstance.getParameterValue(keysByProvider.profile.CustomIdentifier)).toBe("michel@batch.com");
});
