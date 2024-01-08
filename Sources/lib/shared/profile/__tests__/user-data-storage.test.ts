/* eslint-env jest */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { IndexedDbMemoryMock } from "com.batch.shared/persistence/__mocks__/indexed-db-memory-mock";
import { UserDataPersistence } from "com.batch.shared/persistence/user-data";
import { ProfileAttributeType, ProfileCustomDataAttributes } from "com.batch.shared/profile/profile-data-types";
import { UserDataStorage } from "com.batch.shared/profile/user-data-storage";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/user-data");

describe("Profile data storage", () => {
  afterEach(async () => {
    (await (UserDataPersistence.getInstance() as unknown as Promise<IndexedDbMemoryMock>))._resetForTests();
  });

  it("Clear installation data", async () => {
    const persistence = await UserDataPersistence.getInstance();
    const initialStorageStatee = {
      quantity: {
        value: 10,
        type: ProfileAttributeType.INTEGER,
      },
      product: {
        value: "Shoes",
        type: ProfileAttributeType.STRING,
      },
      category: {
        value: new Set(["sport", "footwear"]),
        type: ProfileAttributeType.ARRAY,
      },
    };
    await persistence.setData("attributes", initialStorageStatee);
    const dataStorage = new UserDataStorage(persistence);

    // Ensure we have some attributes in storage
    expect(Object.keys(await dataStorage.getAttributes()).length).toBe(3);

    // Clear attributes
    await dataStorage.removeAttributes();

    // Ensure attributes are cleared
    expect(Object.keys(await dataStorage.getAttributes()).length).toBe(0);
  });

  it("Migrate tags to array attributes", async () => {
    // Populate DB with legacy data
    const persistence = await UserDataPersistence.getInstance();
    const legacyTags = {
      os: ["linux"],
      foo: ["bar", "baz"],
    };
    await persistence.setData("tags", legacyTags);
    const dataStorage = new UserDataStorage(persistence);

    // Ensure attributes are empty before migration
    expect(await dataStorage.getAttributes()).toEqual({});

    // Migrate tags
    await dataStorage.migrateTagsIfNeeded();

    // Ensure tags has been migrated to array attributes
    const expected = {
      os: {
        type: ProfileAttributeType.ARRAY,
        value: new Set(legacyTags.os),
      },
      foo: {
        type: ProfileAttributeType.ARRAY,
        value: new Set(legacyTags.foo),
      },
    };
    expect(await dataStorage.getAttributes()).toEqual(expected);

    // Expect tags table has been removed
    expect(await persistence.getData<{ [key: string]: string[] }>("tags")).toBeNull();
  });
});
