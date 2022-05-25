import { Consts } from "com.batch.shared/constants/user";
import { UserDataPersistence } from "com.batch.shared/persistence/user-data";
import { IOperation, UserAttributeType, UserDataOperation } from "com.batch.shared/user/user-attribute-editor";
import { UserDataStorage } from "com.batch.shared/user/user-data-storage";
import { UserDataWriter } from "com.batch.shared/user/user-data-writer";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/user-data");

describe("User data ", () => {
  it("when params are empty", () => {
    const operations: IOperation[] = [];

    const userDataWriter = new UserDataWriter({}, {});
    const userData = userDataWriter.applyOperations(operations);

    expect(userData).resolves.toEqual({ attributes: {}, tags: {} });
  });

  it("when params are empty and source has attribute", () => {
    const operations: IOperation[] = [];

    const userDataWriter = new UserDataWriter(
      {
        foo: {
          type: UserAttributeType.STRING,
          value: "bar",
        },
        int: {
          type: UserAttributeType.INTEGER,
          value: 22,
        },
      },
      {
        interests: new Set(["foo", "bar"]),
      }
    );
    const userData = userDataWriter.applyOperations(operations);

    expect(userData).resolves.toEqual({
      attributes: {
        foo: {
          type: UserAttributeType.STRING,
          value: "bar",
        },
        int: {
          type: UserAttributeType.INTEGER,
          value: 22,
        },
      },
      tags: {
        interests: new Set(["foo", "bar"]),
      },
    });
  });

  it("properly merges attributes", () => {
    const userDataWriter = new UserDataWriter(
      {
        foo: {
          type: UserAttributeType.STRING,
          value: "bar",
        },
        int: {
          type: UserAttributeType.INTEGER,
          value: 22,
        },
      },
      {
        interests: new Set(["foo", "bar"]),
      }
    );

    const operations: IOperation[] = [
      {
        operation: UserDataOperation.SetAttribute,
        value: "hello",
        key: "hi",
        type: UserAttributeType.STRING,
      },
      {
        operation: UserDataOperation.RemoveAttribute,
        key: "foo",
      },
      {
        operation: UserDataOperation.RemoveTag,
        tag: "foo",
        collection: "interests",
      },
    ];

    const userData = userDataWriter.applyOperations(operations);

    expect(userData).resolves.toEqual({
      attributes: {
        hi: {
          type: UserAttributeType.STRING,
          value: "hello",
        },
        int: {
          type: UserAttributeType.INTEGER,
          value: 22,
        },
      },
      tags: {
        interests: new Set(["bar"]),
      },
    });
  });
});

describe("User Data: tags", () => {
  it("should return the transaction when it's ok", () => {
    const operations: IOperation[] = [
      {
        operation: UserDataOperation.AddTag,
        collection: "hobbies",
        tag: "AMHE",
      },
      {
        operation: UserDataOperation.ClearTags,
      },
      {
        operation: UserDataOperation.AddTag,
        collection: "hobbies",
        tag: "AMHE",
      },
      {
        operation: UserDataOperation.RemoveTag,
        collection: "hobbies",
        tag: "AMHE",
      },
      {
        operation: UserDataOperation.AddTag,
        collection: "interests",
        tag: "sports",
      },
      {
        operation: UserDataOperation.AddTag,
        collection: "HOBBIES",
        tag: "AMHE",
      },
      {
        operation: UserDataOperation.ClearTagCollection,
        collection: "hobbies",
      },
    ];

    const userDataWriter = new UserDataWriter({}, {});
    const userData = userDataWriter.applyOperations(operations);

    expect(userData).resolves.toEqual({ attributes: {}, tags: { interests: new Set(["sports"]) } });
  });

  it("should return throw error when volume limits are exceeded", () => {
    const operations: IOperation[] = [
      {
        operation: UserDataOperation.AddTag,
        collection: "interests",
        tag: "sports",
      },
    ];

    for (let i = 0; i < 103; i++) {
      operations.push({
        operation: UserDataOperation.AddTag,
        collection: "hobbies",
        tag: `AMHE${i}`,
      });
    }

    const userDataWriter = new UserDataWriter({}, {});
    expect(() => userDataWriter.applyOperations(operations)).rejects.toThrow(
      new Error(`A tag collection cannot hold more than ${Consts.MaxUserTagPerCollectionCount} tags. Rolling back transaction.`)
    );
  });

  it("should return throw error when volume limits are exceeded", () => {
    const operations: IOperation[] = [
      {
        operation: UserDataOperation.AddTag,
        collection: "interests",
        tag: "sports",
      },
    ];

    for (let i = 0; i < 53; i++) {
      operations.push({
        operation: UserDataOperation.AddTag,
        collection: `collection${i}`,
        tag: "AMHE",
      });
    }

    const userDataWriter = new UserDataWriter({}, {});
    expect(() => userDataWriter.applyOperations(operations)).rejects.toThrow(
      new Error(`Custom data cannot hold more than ${Consts.MaxUserTagCollectionsCount} tag collections. Rolling back transaction.`)
    );
  });

  describe("User data: Attributes", () => {
    it("should return the transaction when it's ok", () => {
      const operations: IOperation[] = [
        {
          operation: UserDataOperation.SetAttribute,
          value: "amhe",
          key: "hobbies",
          type: UserAttributeType.STRING,
        },
        {
          operation: UserDataOperation.ClearAttributes,
        },
        {
          operation: UserDataOperation.SetAttribute,
          value: "sports",
          key: "hobbies",
          type: UserAttributeType.STRING,
        },
        {
          operation: UserDataOperation.SetAttribute,
          value: 23,
          key: "age",
          type: UserAttributeType.INTEGER,
        },
        {
          operation: UserDataOperation.RemoveAttribute,
          key: "hobbies",
        },
        {
          operation: UserDataOperation.SetAttribute,
          value: "fruits",
          key: "interests",
          type: UserAttributeType.STRING,
        },
      ];

      const userDataWriter = new UserDataWriter({}, {});
      const userData = userDataWriter.applyOperations(operations);

      expect(userData).resolves.toEqual({
        attributes: {
          age: {
            type: "i",
            value: 23,
          },
          interests: {
            type: "s",
            value: "fruits",
          },
        },
        tags: {},
      });
    });

    it("should return throw error when volume limits are exceeded", () => {
      const operations: IOperation[] = [
        {
          operation: UserDataOperation.SetAttribute,
          value: 23,
          key: "age",
          type: UserAttributeType.INTEGER,
        },
      ];

      for (let i = 0; i < 103; i++) {
        operations.push({
          operation: UserDataOperation.SetAttribute,
          value: i,
          key: `key${i}`,
          type: UserAttributeType.INTEGER,
        });
      }

      const userDataWriter = new UserDataWriter({}, {});
      expect(() => userDataWriter.applyOperations(operations)).rejects.toThrow(
        new Error(`Custom data cannot hold more than ${Consts.MaxUserAttributesCount} attributes. Rolling back transaction.`)
      );
    });
  });
});
