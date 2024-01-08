import { UserAttributeType } from "com.batch.shared/profile/user-data-types";
import { AttributesSendService } from "com.batch.shared/webservice/attributes-send";

describe("Attributes Send serialize model to payload", () => {
  test("Serialize attributes, tags and version", () => {
    const attributesSend = new AttributesSendService(
      {
        age: {
          value: 26,
          type: UserAttributeType.INTEGER,
        },
        hobby: {
          value: "sports",
          type: UserAttributeType.STRING,
        },
        startTime: {
          value: 1632182400000,
          type: UserAttributeType.DATE,
        },
      },
      {
        interests: new Set(["sports", "work"]),
      },
      1
    );

    expect(attributesSend.getQuery()).toEqual({
      payload: {
        attrs: { "age.i": 26, "hobby.s": "sports", "starttime.t": 1632182400000 },
        tags: { interests: ["sports", "work"] },
        ver: 1,
      },
    });
  });
});
