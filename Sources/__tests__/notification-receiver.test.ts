/* eslint-env jest */

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { ProfilePersistence } from "com.batch.shared/persistence/profile";
import NotificationReceiver from "com.batch.worker/notification-receiver";

const storage = ProfilePersistence.getInstance();

test("returns an instance with no configuration when unset", () => {
  return NotificationReceiver.getInstance(ParameterStore.getInstance()).then(nr => {
    expect(nr?.["lastKnownConfiguration"]).toBe(null);
  });
});

test("returns an instance with the config if found in db", async () => {
  await (
    await storage
  ).setData(ProfileKeys.LastConfiguration, {
    apiKey: "bonjour",
    subdomain: "bonjour",
    authKey: "bonjour",
  });
  const nr = await NotificationReceiver.getInstance(ParameterStore.getInstance());
  expect(nr?.["lastKnownConfiguration"]?.apiKey).toBe("bonjour");
});
