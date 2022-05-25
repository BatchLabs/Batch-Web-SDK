/* eslint-env jest */

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/user-data");

import BaseSdk from "com.batch.dom/sdk-impl/sdk-base";
import { UserDataPersistence } from "com.batch.shared/persistence/user-data";
import { UserAttributeType } from "com.batch.shared/user/user-attribute-editor";

// Required mock, JSDOM doesn't support Notification
window.Notification = {
  permission: "granted",
} as any;

class TestSDK extends BaseSdk {}

let sdk: TestSDK;

beforeEach(async () => {
  sdk = new TestSDK();
  await sdk.setup({
    apiKey: "DEV12345",
    subdomain: "webpush",
    authKey: "1.test",
    vapidPublicKey: "BDSVNxldVbaALdoOMMp3eBOmZBC9saw6lNP5H1zF5E2eFe2hD_Ooqdzw4BleKK3cRtbP5483XzpGw4QfEqe4mBM",
  } as any);
  await sdk.start();
});

it("can read user attributes using the public API", async () => {
  const now = new Date();

  const persistence = await UserDataPersistence.getInstance();
  await persistence.setData("attributes", {
    age: { type: UserAttributeType.INTEGER, value: 26 },
    foo: { type: UserAttributeType.STRING, value: "bar" },
    date: { type: UserAttributeType.DATE, value: now.getTime() },
  });

  const attributes = await sdk.getUserAttributes();

  expect(Object.keys(attributes).length).toEqual(3);

  const foo = attributes.foo;
  expect(foo.getType()).toEqual(UserAttributeType.STRING);
  expect(foo.getValue()).toStrictEqual("bar");
  expect(foo.getStringValue()).toStrictEqual("bar");
  expect(foo.getNumberValue()).toBeUndefined();
  expect(foo.getDateValue()).toBeUndefined();

  const age = attributes.age;
  expect(age.getType()).toEqual(UserAttributeType.INTEGER);
  expect(age.getValue()).toStrictEqual(26);
  expect(age.getStringValue()).toBeUndefined();
  expect(age.getNumberValue()).toStrictEqual(26);
  expect(age.getDateValue()).toBeUndefined();

  const date = attributes.date;
  expect(date.getType()).toEqual(UserAttributeType.DATE);
  expect(date.getValue()).toEqual(now);
  expect(date.getStringValue()).toBeUndefined();
  expect(date.getNumberValue()).toBeUndefined();
  expect(date.getDateValue()).toEqual(now);
});

it("can read user tags using the public API", async () => {
  const persistence = await UserDataPersistence.getInstance();
  await persistence.setData("tags", {
    interests: ["sports"],
    foo: ["bar", "baz"],
  });

  const tags = await sdk.getUserTagCollections();

  expect(Object.keys(tags).length).toEqual(2);

  expect(tags.interests).toEqual(["sports"]);
  expect(tags.foo).toEqual(["bar", "baz"]);
});
