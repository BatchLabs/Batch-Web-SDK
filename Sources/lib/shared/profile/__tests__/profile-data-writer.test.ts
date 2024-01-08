import { Consts } from "com.batch.shared/constants/user";
import { IProfileOperation, ProfileDataOperation } from "com.batch.shared/profile/profile-attribute-editor";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";
import ProfileDataWriter from "com.batch.shared/profile/profile-data-writer";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/user-data");

describe("User data ", () => {
  it("when params are empty", () => {
    const operations: IProfileOperation[] = [];

    const userDataWriter = new ProfileDataWriter(false);
    const userData = userDataWriter.applyCustomOperations(operations);

    expect(userData).resolves.toEqual({});
  });

  it("when params are empty and source has attribute", () => {
    const operations: IProfileOperation[] = [];

    const userDataWriter = new ProfileDataWriter(true, {
      foo: {
        type: ProfileAttributeType.STRING,
        value: "bar",
      },
      int: {
        type: ProfileAttributeType.INTEGER,
        value: 22,
      },
      interests: {
        type: ProfileAttributeType.ARRAY,
        value: new Set(["foo", "bar"]),
      },
    });
    const userData = userDataWriter.applyCustomOperations(operations);

    expect(userData).resolves.toEqual({
      foo: {
        type: ProfileAttributeType.STRING,
        value: "bar",
      },
      int: {
        type: ProfileAttributeType.INTEGER,
        value: 22,
      },
      interests: {
        type: ProfileAttributeType.ARRAY,
        value: new Set(["foo", "bar"]),
      },
    });
  });

  it("properly merges attributes", () => {
    const userDataWriter = new ProfileDataWriter(true, {
      foo: {
        type: ProfileAttributeType.STRING,
        value: "bar",
      },
      int: {
        type: ProfileAttributeType.INTEGER,
        value: 22,
      },
      interests: {
        type: ProfileAttributeType.ARRAY,
        value: new Set(["foo", "bar"]),
      },
    });

    const operations: IProfileOperation[] = [
      {
        operation: ProfileDataOperation.SetAttribute,
        value: "hello",
        key: "hi",
        type: ProfileAttributeType.STRING,
      },
      {
        operation: ProfileDataOperation.RemoveAttribute,
        key: "foo",
      },
      {
        operation: ProfileDataOperation.RemoveFromArray,
        key: "interests",
        value: ["foo"],
      },
    ];

    const userData = userDataWriter.applyCustomOperations(operations);

    expect(userData).resolves.toEqual({
      foo: { type: "s", value: null },
      hi: {
        type: ProfileAttributeType.STRING,
        value: "hello",
      },
      int: {
        type: ProfileAttributeType.INTEGER,
        value: 22,
      },
      interests: {
        type: ProfileAttributeType.ARRAY,
        value: new Set(["bar"]),
      },
    });
  });
});

describe("User data: Attributes", () => {
  it("should return the transaction when it's ok", () => {
    const operations: IProfileOperation[] = [
      {
        operation: ProfileDataOperation.SetAttribute,
        value: "amhe",
        key: "hobbies",
        type: ProfileAttributeType.STRING,
      },
      {
        operation: ProfileDataOperation.SetAttribute,
        value: "sports",
        key: "hobbies",
        type: ProfileAttributeType.STRING,
      },
      {
        operation: ProfileDataOperation.SetAttribute,
        value: 23,
        key: "age",
        type: ProfileAttributeType.INTEGER,
      },
      {
        operation: ProfileDataOperation.RemoveAttribute,
        key: "hobbies",
      },
      {
        operation: ProfileDataOperation.SetAttribute,
        value: "fruits",
        key: "interests",
        type: ProfileAttributeType.STRING,
      },
      {
        operation: ProfileDataOperation.AddToArray,
        key: "os",
        value: ["linux"],
      },
      {
        operation: ProfileDataOperation.AddToArray,
        key: "os",
        value: ["linux"],
      },
      {
        operation: ProfileDataOperation.RemoveFromArray,
        key: "os",
        value: ["linux"],
      },
      {
        operation: ProfileDataOperation.AddToArray,
        key: "games",
        value: ["aoe2"],
      },
    ];

    const userDataWriter = new ProfileDataWriter(true);
    const userData = userDataWriter.applyCustomOperations(operations);

    expect(userData).resolves.toEqual({
      age: {
        type: "i",
        value: 23,
      },
      hobbies: {
        type: "s",
        value: null,
      },
      interests: {
        type: "s",
        value: "fruits",
      },
      os: { value: null, type: "a" },
      games: { value: new Set(["aoe2"]), type: "a" },
    });
  });

  it("should return throw error when volume limits are exceeded", () => {
    const operations: IProfileOperation[] = [];

    for (let i = 0; i < 51; i++) {
      operations.push({
        operation: ProfileDataOperation.SetAttribute,
        value: i,
        key: `key${i}`,
        type: ProfileAttributeType.INTEGER,
      });
    }

    const userDataWriter = new ProfileDataWriter(true);
    expect(() => userDataWriter.applyCustomOperations(operations)).rejects.toThrow(
      new Error(`Custom data cannot hold more than ${Consts.MaxProfileAttributesCount} attributes. Rolling back transaction.`)
    );
  });

  it("should return throw error when array attributes count limits are exceeded", () => {
    const operations: IProfileOperation[] = [];

    for (let i = 0; i < 16; i++) {
      operations.push({
        operation: ProfileDataOperation.SetAttribute,
        value: new Set([`value${i}`]),
        key: `key${i}`,
        type: ProfileAttributeType.ARRAY,
      });
    }

    const userDataWriter = new ProfileDataWriter(true);
    expect(() => userDataWriter.applyCustomOperations(operations)).rejects.toThrow(
      new Error(`Custom data cannot hold more than ${Consts.MaxProfileArrayAttributesCount} array attributes. Rolling back transaction.`)
    );
  });

  it("should return throw error when volume limits are exceeded", () => {
    const operations: IProfileOperation[] = [];
    const values = [];
    for (let i = 0; i < 26; i++) {
      values.push(`AMHE${i}`);
    }
    operations.push({
      operation: ProfileDataOperation.AddToArray,
      key: "hobbies",
      value: values,
    });
    const userDataWriter = new ProfileDataWriter(true);
    expect(() => userDataWriter.applyCustomOperations(operations)).rejects.toThrow(
      new Error(`An ARRAY attribute cannot hold more than ${Consts.MaxProfileArrayItems} items. Rolling back transaction.`)
    );
  });
});
