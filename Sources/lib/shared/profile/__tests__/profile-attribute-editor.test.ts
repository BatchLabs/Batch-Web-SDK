// @ts-nocheck
import { ProfileAttributeEditor, ProfileDataOperation } from "../profile-attribute-editor";
import { ProfileAttributeType, ProfileNativeAttributeType } from "../profile-data-types";

describe("Profile data editor", () => {
  describe("Custom Attributes", () => {
    it("should not return operations on invalid values", () => {
      const editor = new ProfileAttributeEditor(false);
      editor
        .setAttribute("interests", "")
        .setAttribute("", "")
        .setAttribute(1, 1)
        .setAttribute(undefined, "sports")
        .setAttribute("interests", "stringTooLong".repeat(30))
        .setAttribute("website", {
          type: ProfileAttributeType.URL,
          value: new Date(),
        })
        .setAttribute("nickname", {
          type: ProfileAttributeType.STRING,
          value: new Date(),
        })
        .setAttribute("age", {
          type: ProfileAttributeType.INTEGER,
          value: true,
        })
        .setAttribute("pi", {
          type: ProfileAttributeType.FLOAT,
          value: false,
        })
        .setAttribute("date", {
          type: ProfileAttributeType.DATE,
          value: 1632182400000,
        })
        .setAttribute("exist", {
          type: ProfileAttributeType.BOOLEAN,
          value: 1,
        })
        .setAttribute("array", {
          type: ProfileAttributeType.ARRAY,
          value: [
            "stringTooLong".repeat(30)
          ],
        })
        .addToArray("interests", [""])
        .addToArray("", [""])
        .addToArray(1, [1])
        .addToArray(undefined, ["sports"])
        .addToArray("interests", [
          "stringTooLong".repeat(30)
        ])
        .removeFromArray("interests", [""])
        .removeFromArray("", [""])
        .removeFromArray(1, [1])
        .removeFromArray(undefined, ["sports"])
        .removeFromArray("interests", [
          "stringTooLong".repeat(30)
        ]);

      const operations = editor.getOperations();

      expect(operations).toEqual([]);
    });

    it("it can set, remove and clear attributes", () => {
      const editor = new ProfileAttributeEditor(false);
      editor
        .setAttribute("interests", "sports")
        .setAttribute("Hobby", "sports")
        .setAttribute("website", {
          type: ProfileAttributeType.URL,
          value: "https://blog.batch.com",
        })
        .setAttribute("nickname", {
          type: ProfileAttributeType.STRING,
          value: "John63",
        })
        .setAttribute("age", {
          type: ProfileAttributeType.INTEGER,
          value: 1,
        })
        .setAttribute("pi", {
          type: ProfileAttributeType.FLOAT,
          value: 1.11,
        })
        .setAttribute("date", {
          type: ProfileAttributeType.DATE,
          value: new Date("2021-09-21"),
        })
        .removeAttribute("date")
        .setAttribute("exist", {
          type: ProfileAttributeType.BOOLEAN,
          value: true,
        })
        .addToArray("interests", ["sports"])
        .addToArray("Hobby", ["sports"])
        .removeAttribute("interests")
        .addToArray("bio", ["fruits", "vegetables"])
        .removeFromArray("bio", ["fruits", "vegetables"]);

      const operations = editor.getOperations();

      expect(operations).toEqual([
        { key: "interests", operation: "SET_ATTRIBUTE", value: "sports", type: ProfileAttributeType.STRING },
        { key: "hobby", operation: "SET_ATTRIBUTE", value: "sports", type: ProfileAttributeType.STRING },
        { key: "website", operation: "SET_ATTRIBUTE", value: "https://blog.batch.com/", type: ProfileAttributeType.URL },
        { key: "nickname", operation: "SET_ATTRIBUTE", value: "John63", type: ProfileAttributeType.STRING },
        { key: "age", operation: "SET_ATTRIBUTE", value: 1, type: ProfileAttributeType.INTEGER },
        { key: "pi", operation: "SET_ATTRIBUTE", value: 1.11, type: ProfileAttributeType.FLOAT },
        { key: "date", operation: "SET_ATTRIBUTE", value: 1632182400000, type: ProfileAttributeType.DATE },
        { key: "date", operation: "REMOVE_ATTRIBUTE" },
        { key: "exist", operation: "SET_ATTRIBUTE", value: true, type: ProfileAttributeType.BOOLEAN },
        { key: "interests", operation: "ADD_TO_ARRAY", value: ["sports"] },
        { key: "hobby", operation: "ADD_TO_ARRAY", value: ["sports"] },
        { key: "interests", operation: "REMOVE_ATTRIBUTE" },
        { key: "bio", operation: "ADD_TO_ARRAY", value: ["fruits", "vegetables"] },
        { key: "bio", operation: "REMOVE_FROM_ARRAY", value: ["fruits", "vegetables"] },
      ]);
    });
  });
  describe("Native attributes", () => {
    describe("Email ", () => {
      it("Valid email should not return operations when not logged", () => {
        const editor = new ProfileAttributeEditor(false);
        editor.setEmailAddress("test@batch.com");
        expect(editor.getOperations()).toEqual([]);
      });

      it("Valid email should return operations when logged", () => {
        const editor = new ProfileAttributeEditor(true);
        const validEmail = "test@batch.com";
        editor.setEmailAddress(validEmail);
        expect(editor.getOperations()).toEqual([
          {
            operation: ProfileDataOperation.SetEmail,
            key: ProfileNativeAttributeType.EMAIL,
            value: validEmail,
          },
        ]);
      });

      it("Invalid email should not return operations", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setEmailAddress("test@batch");
        expect(editor.getOperations()).toEqual([]);
        editor.setEmailAddress("batch.com");
        expect(editor.getOperations()).toEqual([]);
        editor.setEmailAddress("test@batch.com.");
        expect(editor.getOperations()).toEqual([]);
      });
    });

    describe("Email Marketing Subscription ", () => {
      it("Valid email marketing subscription", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setEmailMarketingSubscription("subscribed");
        expect(editor.getOperations()).toEqual([
          {
            operation: ProfileDataOperation.SetEmailMarketingSubscriptionState,
            key: ProfileNativeAttributeType.EMAIL_MARKETING,
            value: "subscribed",
          },
        ]);
      });

      it("Invalid email marketing subscription", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setEmailMarketingSubscription("subscribe");
        expect(editor.getOperations()).toEqual([]);
      });
    });

    describe("Language ", () => {
      it("Valid language", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setLanguage("fr");
        expect(editor.getOperations()).toEqual([
          {
            operation: ProfileDataOperation.SetLanguage,
            key: ProfileNativeAttributeType.LANGUAGE,
            value: "fr",
          },
        ]);
      });

      it("Null valid language", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setLanguage(null);
        expect(editor.getOperations()).toEqual([
          {
            operation: ProfileDataOperation.SetLanguage,
            key: ProfileNativeAttributeType.LANGUAGE,
            value: null,
          },
        ]);
      });

      it("Invalid language", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setLanguage("f");
        expect(editor.getOperations()).toEqual([]);
      });
    });

    describe("Region ", () => {
      it("Valid region", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setRegion("FR");
        expect(editor.getOperations()).toEqual([
          {
            operation: ProfileDataOperation.SetRegion,
            key: ProfileNativeAttributeType.REGION,
            value: "FR",
          },
        ]);
      });
      it("Null valid region", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setRegion(null);
        expect(editor.getOperations()).toEqual([
          {
            operation: ProfileDataOperation.SetRegion,
            key: ProfileNativeAttributeType.REGION,
            value: null,
          },
        ]);
      });
      it("Invalid region", () => {
        const editor = new ProfileAttributeEditor(true);
        editor.setLanguage("F");
        expect(editor.getOperations()).toEqual([]);
      });
    });
    it("All natives should return operations", () => {
      const editor = new ProfileAttributeEditor(true);
      editor.setEmailAddress("test@batch.com").setEmailMarketingSubscription("subscribed").setLanguage("fr").setRegion("FR");

      const operations = editor.getOperations();

      expect(operations).toEqual([
        {
          operation: ProfileDataOperation.SetEmail,
          key: ProfileNativeAttributeType.EMAIL,
          value: "test@batch.com",
        },
        {
          operation: ProfileDataOperation.SetEmailMarketingSubscriptionState,
          key: ProfileNativeAttributeType.EMAIL_MARKETING,
          value: "subscribed",
        },
        {
          operation: ProfileDataOperation.SetLanguage,
          key: ProfileNativeAttributeType.LANGUAGE,
          value: "fr",
        },
        {
          operation: ProfileDataOperation.SetRegion,
          key: ProfileNativeAttributeType.REGION,
          value: "FR",
        },
      ]);
    });
  });
});
