// @ts-nocheck
/* eslint-disable @typescript-eslint/camelcase */

import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import { ProfileAttributeType, ProfileCustomDataAttributes, ProfileNativeDataAttribute } from "com.batch.shared/profile/profile-data-types";
import { ProfileEventBuilder } from "com.batch.shared/profile/profile-events";

const natives: ProfileNativeDataAttribute[] = [
  {
    key: "email",
    value: "test@batch.com",
  },
  {
    key: "email_marketing",
    value: "subscribed",
  },
  {
    key: "language",
    value: "fr",
  },
  {
    key: "region",
    value: "FR",
  },
];

const customs: ProfileCustomDataAttributes = {
  label: {
    type: ProfileAttributeType.STRING,
    value: "label",
  },
  count: {
    type: ProfileAttributeType.INTEGER,
    value: 1,
  },
  price: {
    type: ProfileAttributeType.FLOAT,
    value: 3.45,
  },
  website: {
    type: ProfileAttributeType.URL,
    value: "https://blog.batch.com",
  },
  birthday: {
    type: ProfileAttributeType.DATE,
    value: 1632182400000,
  },
  isPremium: {
    type: ProfileAttributeType.BOOLEAN,
    value: true,
  },
  interests: {
    type: ProfileAttributeType.ARRAY,
    value: new Set(["sport", "cars"]),
  },
};

describe("Profile events", () => {
  describe("Profile Data Changed", () => {
    it("Test event without custom attributes", () => {
      const event = new ProfileEventBuilder().withNativeAttributes(natives).build();
      expect(event.name).toEqual(InternalSDKEvent.ProfileDataChanged);
      expect(event.params).toEqual({
        email: "test@batch.com",
        email_marketing: "subscribed",
        language: "fr",
        region: "FR",
      });
    });
    it("Test event without natives attributes", () => {
      const event = new ProfileEventBuilder().withCustomAttributes(customs).build();
      expect(event.name).toEqual(InternalSDKEvent.ProfileDataChanged);
      expect(event.params).toEqual({
        custom_attributes: {
          "label.s": "label",
          "count.i": 1,
          "price.f": 3.45,
          "website.u": "https://blog.batch.com",
          "birthday.t": 1632182400000,
          "ispremium.b": true,
          "interests.a": ["sport", "cars"],
        },
      });
    });
    it("Test event with all attributes", () => {
      const event = new ProfileEventBuilder().withCustomAttributes(customs).withNativeAttributes(natives).build();
      expect(event.name).toEqual(InternalSDKEvent.ProfileDataChanged);
      expect(event.params).toEqual({
        email: "test@batch.com",
        email_marketing: "subscribed",
        language: "fr",
        region: "FR",
        custom_attributes: {
          "label.s": "label",
          "count.i": 1,
          "price.f": 3.45,
          "website.u": "https://blog.batch.com",
          "birthday.t": 1632182400000,
          "ispremium.b": true,
          "interests.a": ["sport", "cars"],
        },
      });
    });
  });
});
