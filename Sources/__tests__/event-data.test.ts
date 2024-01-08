import { EventData } from "../lib/shared/event/event-data";
import { TypedEventAttributeType } from "../lib/shared/event/event-types";

describe("Event Data to internal representation", () => {
  it("when params are empty, empty tags and attributes should be returned, not tags ", () => {
    const eventData = new EventData({});

    expect(eventData).toEqual({
      attributes: {},
      tags: [],
    });
  });
});

describe("Event Data: Label", () => {
  it("should return the label", () => {
    const eventData = new EventData({ attributes: { $label: "label" } });

    expect(eventData).toEqual({
      attributes: {},
      tags: [],
      label: "label",
    });
  });

  it("should not return the label when is equal to null", () => {
    const eventData = new EventData({ attributes: { $label: undefined } });

    expect(eventData).toEqual({
      attributes: {},
      tags: [],
    });
  });

  it("should not return the label when longer than 200 characters", () => {
    const eventData = new EventData({
      attributes: {
        $label:
          "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovo" +
          "lcanoconiosispneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicrosc" +
          "opicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis",
      },
    });

    expect(eventData).toEqual({
      attributes: {},
      tags: [],
    });
  });

  it("should not return the label when it is not a STRING", () => {
    const eventData = new EventData({ attributes: { $label: 3 } });
    expect(eventData).toEqual({
      attributes: {},
      tags: [],
    });
  });
});

describe("Event Data: Tags", () => {
  it("should return all tags excepts duplicates", () => {
    const { tags } = new EventData({ attributes: { $tags: ["sports", "fruits", "foot"] } });

    expect(tags).toEqual(["sports", "fruits", "foot"]);
  });

  it("should return 10 tags maximum", () => {
    const { tags } = new EventData({ attributes: { $tags: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"] } });

    expect(tags).toHaveLength(10);
  });

  it("should return the lowercase tag", () => {
    const { tags } = new EventData({ attributes: { $tags: ["TAG"] } });

    expect(tags).toEqual(["tag"]);
  });

  it("should not return the tag when it undefined", () => {
    const { tags } = new EventData({ attributes: { $tags: undefined } });

    expect(tags).toEqual([]);
  });

  it("should not return the tag when it's not a string", () => {
    const { tags } = new EventData({ attributes: { $tags: [1, "foot"] } });

    expect(tags).toEqual(["foot"]);
  });

  it("should not return the tag when it's longer than 64 characters", () => {
    const { tags } = new EventData({
      attributes: {
        $tags: ["pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis"],
      },
    });

    expect(tags).toEqual([]);
  });
});

describe("Event Data: Attributes", () => {
  it("should return 20 attributes maximum", () => {
    const { attributes } = new EventData({
      attributes: {
        key1: "value",
        key2: "value",
        key3: "value",
        key4: "value",
        key5: "value",
        key6: "value",
        key7: "value",
        key8: "value",
        key9: "value",
        key10: "value",
        key11: "value",
        key12: "value",
        key13: "value",
        key14: "value",
        key15: "value",
        key16: "value",
        key17: "value",
        key18: "value",
        key19: "value",
        key20: "value",
        key21: "value",
        $label: "label",
        $tags: ["michel", "c'est le bresil"],
      },
    });

    expect(Object.keys(attributes)).toHaveLength(20);
  });

  it("should not return attribute when it is an invalid key", () => {
    const { attributes } = new EventData({
      attributes: {
        pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis: "value",
      },
    });

    expect(attributes).toEqual({});
  });

  it("should not return the attribute when it's longer than 200 characters", () => {
    const { attributes } = new EventData({
      attributes: {
        key:
          "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosi" +
          "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosiss" +
          "silicovolcanoconiosis",
      },
    });

    expect(attributes).toEqual({});
  });

  it("should not return attribute when it is an invalid value", () => {
    const { attributes } = new EventData({
      attributes: {
        key: undefined,
        key2: null,
      },
    });

    expect(attributes).toEqual({});
  });

  it("should return the key of the attribute in lowercase", () => {
    const { attributes } = new EventData({
      attributes: {
        KEY: "value",
        KEY1: {
          type: TypedEventAttributeType.STRING,
          value: "value",
        },
      },
    });

    expect(attributes).toEqual({ "key.s": "value", "key1.s": "value" });
  });

  // =================== ATTRIBUTE TYPED ONLY
  it("must return an attribute corresponding to its typing when it is STRING", () => {
    const { attributes } = new EventData({
      attributes: {
        key: {
          type: TypedEventAttributeType.STRING,
          value: 1,
        },
        key1: {
          type: TypedEventAttributeType.STRING,
          value: "value",
        },
        keyInError:
          "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis" +
          "pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis" +
          "covolcanoconiosisazert",
        absurdity: {
          type: TypedEventAttributeType.STRING,
          value: new Date(),
        },
      },
    });

    expect(attributes).toEqual({ "key.s": "1", "key1.s": "value" });
  });

  it("must return an attribute corresponding to its typing when it is INTEGER", () => {
    const { attributes } = new EventData({
      attributes: {
        key: {
          type: TypedEventAttributeType.INTEGER,
          value: 1,
        },
        key1: {
          type: TypedEventAttributeType.INTEGER,
          value: "0",
        },
        key2: {
          type: TypedEventAttributeType.INTEGER,
          value: 5.33,
        },
        absurdity: {
          type: TypedEventAttributeType.INTEGER,
          value: new Date(),
        },
      },
    });

    expect(attributes).toEqual({ "key.i": 1, "key1.i": 0, "key2.i": 6 });
  });

  it("must return an attribute corresponding to its typing when it is FLOAT", () => {
    const { attributes } = new EventData({
      attributes: {
        key: {
          type: TypedEventAttributeType.FLOAT,
          value: 1.33,
        },
        key1: {
          type: TypedEventAttributeType.FLOAT,
          value: "5.11",
        },
        absurdity: {
          type: TypedEventAttributeType.FLOAT,
          value: new Date(),
        },
      },
    });

    expect(attributes).toEqual({ "key.f": 1.33, "key1.f": 5.11 });
  });

  it("must return an attribute corresponding to its typing when it is BOOLEAN", () => {
    const { attributes } = new EventData({
      attributes: {
        key: {
          type: TypedEventAttributeType.BOOLEAN,
          value: 1,
        },
        key1: {
          type: TypedEventAttributeType.BOOLEAN,
          value: "0",
        },
        key2: {
          type: TypedEventAttributeType.BOOLEAN,
          value: "true",
        },
        key3: {
          type: TypedEventAttributeType.BOOLEAN,
          value: "foo",
        },
        key4: {
          type: TypedEventAttributeType.BOOLEAN,
          value: false,
        },
        absurdity: {
          type: TypedEventAttributeType.BOOLEAN,
          value: new Date(),
        },
      },
    });

    expect(attributes).toEqual({ "key.b": true, "key4.b": false });
  });

  it("must return an attribute corresponding to its typing when it is DATE", () => {
    const { attributes } = new EventData({
      attributes: {
        key: {
          type: TypedEventAttributeType.DATE,
          value: new Date("2021-09-21"),
        },
        key1: {
          type: TypedEventAttributeType.DATE,
          value: 1645437237,
        },
        key2: {
          type: TypedEventAttributeType.DATE,
          value: "2020-10-21T00:00:00.000Z",
        },
        absurdity: {
          type: TypedEventAttributeType.DATE,
          value: 0,
        },
      },
    });

    expect(attributes).toEqual({
      "key.t": 1632182400000,
    });
  });

  it("must return an attribute corresponding to its typing when it is URL", () => {
    let badUrl = "batch.com";
    for (let jkk = 0; jkk < 89; jkk++) {
      badUrl = badUrl + "batch.com";
    }

    const { attributes } = new EventData({
      attributes: {
        key: {
          type: TypedEventAttributeType.URL,
          value: "https://www.google.com",
        },
        key1: {
          type: TypedEventAttributeType.URL,
          value: new URL("https://www.google.com"),
        },
        key2: {
          type: TypedEventAttributeType.URL,
          value: badUrl,
        },
        absurdity: {
          type: TypedEventAttributeType.URL,
          value: new Date(),
        },
      },
    });

    expect(attributes).toEqual({ "key.u": "https://www.google.com/", "key1.u": "https://www.google.com/" });
  });

  // =================== AUTO-DETECT ATTRIBUTE
  it("must return the key correspond to STRING when the value is a String", () => {
    const { attributes } = new EventData({
      attributes: {
        key: "1",
      },
    });

    expect(attributes).toEqual({ "key.s": "1" });
  });

  it("must return the key correspond to INTEGER when the value is a INTEGER", () => {
    const { attributes } = new EventData({
      attributes: {
        key: 1,
      },
    });

    expect(attributes).toEqual({ "key.i": 1 });
  });

  it("must return the key correspond to FLOAT when the value is a FLOAT", () => {
    const { attributes } = new EventData({
      attributes: {
        key: 1.33,
      },
    });

    expect(attributes).toEqual({ "key.f": 1.33 });
  });

  it("must return the key correspond to BOOLEAN when the value is a BOOLEAN", () => {
    const { attributes } = new EventData({
      attributes: {
        key: true,
      },
    });

    expect(attributes).toEqual({ "key.b": true });
  });

  it("must return the key correspond to DATE when the value is a DATE", () => {
    const { attributes } = new EventData({
      attributes: {
        key: new Date("2021-09-21"),
      },
    });

    expect(attributes).toEqual({
      "key.t": 1632182400000,
    });
  });

  it("must return the key correspond to URL when the value is a URL", () => {
    let badUrl = "https://www.batch.com";
    for (let jkk = 0; jkk < 227; jkk++) {
      badUrl = badUrl + "batch.com";
    }

    const { attributes } = new EventData({
      attributes: {
        key: new URL("https://www.google.com"),
        key2: new URL(badUrl),
      },
    });

    expect(attributes).toEqual({ "key.u": "https://www.google.com/" });
  });
});
