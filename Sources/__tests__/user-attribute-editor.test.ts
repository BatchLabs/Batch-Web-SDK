import { UserAttributeEditor, UserAttributeType } from "com.batch.shared/user/user-attribute-editor";

describe("User attribute editor: Tags", () => {
  it("should not return operations on invalid values", () => {
    const editor = new UserAttributeEditor();
    editor
      .addTag("interests", "")
      .addTag("", "")
      .addTag(1, 1)
      .addTag(undefined, "sports")
      .addTag("interests", "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis");

    const operations = editor._getOperations();

    expect(operations).toEqual([]);
  });

  it("it can add, delete and clear tag collections", () => {
    const editor = new UserAttributeEditor();
    editor
      .addTag("interests", "sports")
      .addTag("Hobby", "sports")
      .clearTags()
      .clearTagCollection("interests")
      .addTag("bio", "fruits")
      .removeTag("bio", "fruits");

    const operations = editor._getOperations();

    expect(operations).toEqual([
      { collection: "interests", operation: "ADD_TAG", tag: "sports" },
      { collection: "hobby", operation: "ADD_TAG", tag: "sports" },
      { operation: "CLEAR_TAGS" },
      { collection: "interests", operation: "CLEAR_TAG_COLLECTION" },
      { collection: "bio", operation: "ADD_TAG", tag: "fruits" },
      { collection: "bio", operation: "REMOVE_TAG", tag: "fruits" },
    ]);
  });
});

describe("User attribute editor: Attributes", () => {
  it("should not return operations on invalid values", () => {
    const editor = new UserAttributeEditor();
    editor
      .setAttribute("interests", "")
      .setAttribute("", "")
      .setAttribute(1, 1)
      .setAttribute(undefined, "sports")
      .setAttribute("interests", "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis")
      .setAttribute("website", {
        type: UserAttributeType.URL,
        value: new Date(),
      })
      .setAttribute("nickname", {
        type: UserAttributeType.STRING,
        value: new Date(),
      })
      .setAttribute("age", {
        type: UserAttributeType.INTEGER,
        value: true,
      })
      .setAttribute("pi", {
        type: UserAttributeType.FLOAT,
        value: false,
      })
      .setAttribute("date", {
        type: UserAttributeType.DATE,
        value: 1632182400000,
      })
      .setAttribute("exist", {
        type: UserAttributeType.BOOLEAN,
        value: 1,
      });

    const operations = editor._getOperations();

    expect(operations).toEqual([]);
  });

  it("it can set, remove and clear attributes", () => {
    const editor = new UserAttributeEditor();
    editor
      .setAttribute("interests", "sports")
      .setAttribute("Hobby", "sports")
      .setAttribute("website", {
        type: UserAttributeType.URL,
        value: "https://blog.batch.com",
      })
      .setAttribute("nickname", {
        type: UserAttributeType.STRING,
        value: "John63",
      })
      .setAttribute("age", {
        type: UserAttributeType.INTEGER,
        value: 1,
      })
      .setAttribute("pi", {
        type: UserAttributeType.FLOAT,
        value: 1.11,
      })
      .clearAttributes()
      .setAttribute("date", {
        type: UserAttributeType.DATE,
        value: new Date("2021-09-21"),
      })
      .removeAttribute("date")
      .setAttribute("exist", {
        type: UserAttributeType.BOOLEAN,
        value: true,
      });

    const operations = editor._getOperations();

    expect(operations).toEqual([
      { key: "interests", operation: "SET_ATTRIBUTE", value: "sports", type: UserAttributeType.STRING },
      { key: "hobby", operation: "SET_ATTRIBUTE", value: "sports", type: UserAttributeType.STRING },
      { key: "website", operation: "SET_ATTRIBUTE", value: "https://blog.batch.com/", type: UserAttributeType.URL },
      { key: "nickname", operation: "SET_ATTRIBUTE", value: "John63", type: UserAttributeType.STRING },
      { key: "age", operation: "SET_ATTRIBUTE", value: 1, type: UserAttributeType.INTEGER },
      { key: "pi", operation: "SET_ATTRIBUTE", value: 1.11, type: UserAttributeType.FLOAT },
      { operation: "CLEAR_ATTRIBUTES" },
      { key: "date", operation: "SET_ATTRIBUTE", value: 1632182400000, type: UserAttributeType.DATE },
      { key: "date", operation: "REMOVE_ATTRIBUTE" },
      { key: "exist", operation: "SET_ATTRIBUTE", value: true, type: UserAttributeType.BOOLEAN },
    ]);
  });
});
