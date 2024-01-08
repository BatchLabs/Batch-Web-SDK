/* eslint-env jest */
/* eslint-disable @typescript-eslint/camelcase */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import BaseSdk from "com.batch.dom/sdk-impl/sdk-base";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import EventTracker from "com.batch.shared/event/event-tracker";
import { Delay } from "com.batch.shared/helpers/timed-promise";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { ProbationManager } from "com.batch.shared/managers/probation-manager";
import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IndexedDbMemoryMock } from "com.batch.shared/persistence/__mocks__/indexed-db-memory-mock";
import { ProfilePersistence } from "com.batch.shared/persistence/profile";
import { UserDataPersistence } from "com.batch.shared/persistence/user-data";
import { ProfileAttributeEditor } from "com.batch.shared/profile/profile-attribute-editor";
import { ProfileModule } from "com.batch.shared/profile/profile-module";
import { MockWebserviceExecutor } from "com.batch.shared/test-utils/mock-webservice-executor";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/user-data");
jest.mock("com.batch.shared/event/event-tracker");

const webserviceExecutor = new MockWebserviceExecutor({ action: "OK" });

async function initProfileModule(): Promise<{ profileModule: ProfileModule; eventTracker: EventTracker }> {
  const probationManager = new ProbationManager(await ParameterStore.getInstance());
  const persistence = await UserDataPersistence.getInstance();
  const profilePersistence = await ProfilePersistence.getInstance();
  await profilePersistence.setData("di", "test_installation_id");
  const eventTracker = new EventTracker(true, webserviceExecutor);
  return { profileModule: new ProfileModule(probationManager, persistence, webserviceExecutor, eventTracker, null), eventTracker };
}

describe("Profile Module", () => {
  afterEach(async () => {
    LocalEventBus._resetForTests();
    (await (UserDataPersistence.getInstance() as unknown as Promise<IndexedDbMemoryMock>))._resetForTests();
    (await (ProfilePersistence.getInstance() as unknown as Promise<IndexedDbMemoryMock>))._resetForTests();
  });

  describe("Profile Data Editor", () => {
    it("ProfileDataChanged triggered when system param change", async () => {
      const expectedLanguageTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: { device_language: "en-US" },
      });
      const expectedRegionTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: { device_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      const { eventTracker } = await initProfileModule();
      await Delay(300);
      expect(eventTracker.track).toHaveBeenCalledTimes(2);
      expect(eventTracker.track).toHaveBeenCalledWith(expectedLanguageTrackedEvent);
      expect(eventTracker.track).toHaveBeenCalledWith(expectedRegionTrackedEvent);
    });

    it("ProfileDataChanged event NOT triggered when empty", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.setAttribute("label", "");
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: {},
      });
      expect(eventTracker.track).not.toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged event triggered when custom data change", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.setAttribute("label", "test");
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: { custom_attributes: { "label.s": "test" } },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged event triggered when native data change", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.setLanguage("fr");
        editor.setRegion("FR");
        editor.setEmailMarketingSubscription("subscribed");
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: { language: "fr", region: "FR", email_marketing: "subscribed" },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged event triggered when custom and native data change", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.setLanguage("fr");
        editor.setRegion("FR");
        editor.setEmailAddress("test@batch.com"); // should not be sent since logged out
        editor.setEmailMarketingSubscription("subscribed");
        editor.setAttribute("label", "test");
        editor.setAttribute("price", 10);
        editor.setAttribute("interests", ["sport", "cars", "boats"]);
        editor.addToArray("os", ["linux"]);
        editor.removeFromArray("os", ["windows"]);
        editor.addToArray("cars", ["honda"]);
        editor.removeFromArray("games", ["aoe2"]);
        editor.removeAttribute("key_not_suffixed"); // key should not be suffixed since we do not know the type
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: {
          language: "fr",
          region: "FR",
          email_marketing: "subscribed",
          custom_attributes: {
            "label.s": "test",
            "price.i": 10,
            "interests.a": ["sport", "cars", "boats"],
            "os.a": { $add: ["linux"], $remove: ["windows"] },
            "cars.a": { $add: ["honda"] },
            "games.a": { $remove: ["aoe2"] },
            key_not_suffixed: null,
          },
        },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged - set array attribute then remove item", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.setAttribute("interests", ["sport", "cars", "boats"]);
        editor.removeFromArray("interests", ["boats"]);
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: {
          custom_attributes: {
            "interests.a": ["sport", "cars"],
          },
        },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged - removing item from removed array attribute", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.removeAttribute("os");
        editor.removeFromArray("os", ["windows"]);
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: {
          custom_attributes: {
            "os.a": null,
          },
        },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged - adding item from removed array attribute", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.removeAttribute("os");
        editor.addToArray("os", ["windows"]);
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: {
          custom_attributes: {
            "os.a": ["windows"],
          },
        },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged - Add to array then re-set new attribute", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.addToArray("os", ["windows"]);
        editor.setAttribute("os", "linux");
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: {
          custom_attributes: {
            "os.s": "linux",
          },
        },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("ProfileDataChanged - Add to array then remove it", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.edit((editor: ProfileAttributeEditor) => {
        editor.addToArray("os", ["windows"]);
        editor.removeAttribute("os");
      });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileDataChanged,
        params: {
          custom_attributes: {
            "os.a": null,
          },
        },
      });
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });
  });

  describe("Profile Identify", () => {
    it("ProfileIdentify Login (with custom_id)", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.identify({ customId: "test_custom_identifier" });
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileIdentify,
        params: {
          identifiers: {
            custom_id: "test_custom_identifier",
            install_id: "test_installation_id",
          },
        },
      });
      await Delay(100);
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });
    it("ProfileIdentify Logout (without custom_id) - null", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.identify(null);
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileIdentify,
        params: {
          identifiers: {
            install_id: "test_installation_id",
          },
        },
      });
      await Delay(100);
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });
    it("ProfileIdentify Logout (without custom_id) - undefined", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      await profile.identify();
      const expectedTrackedEvent = expect.objectContaining({
        name: InternalSDKEvent.ProfileIdentify,
        params: {
          identifiers: {
            install_id: "test_installation_id",
          },
        },
      });
      await Delay(200);
      expect(eventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
    });

    it("Identify should be a string", async () => {
      const { profileModule, eventTracker } = await initProfileModule();
      const profile = await profileModule.get();
      expect(() => profile.identify({ customId: 3 })).rejects.toThrow(
        new Error("Custom identifier must be a string and can’t be longer than 512 characters.")
      );
    });

    it("Identify can't be longer than 512", async () => {
      const { profileModule } = await initProfileModule();
      const profile = await profileModule.get();
      const customId =
        "1bKSn7Y9TtgDaCN5zfnLFKiF7vByKrW0TFIM58Fm5LNuITK8abzNZvh1abUtfpL56tLxFvVVzOQD2fRLYZJAKyaWSl67JQFkT88Ct10cVrW95kFUtvq4" +
        "D5LRwMguHpzeSrh4nQMzOlhlClRGB2lR5PlbdTHY8Ybm7cYmelKvBUnPUR2VjpRzqrT6qCv0aXOBV9PLZ7uttqMR9t7NeGbMD3kQn3xubSJV06H4aoVguv" +
        "T1qGxSADV2m7JcUhaGLyLB9fATuGNdmf1vmP6d45RFIL3w6AeLBkxX9haQo8adZBJBjgZguhqVkA06xYrh7aDMsiw8d8pVQxKw5l4iIa0LDWOMiv2De3ZZQv" +
        "lGKt7SEXN39MW0kQR7Xu8zsaXp75bTj9iGKWKnSjXBs8js5FfG1RRPrrsricFcg7COrXoMSPAZAjVUBrtXIH4TMzyvjSB3d9q4Yb69LnDuElUB6UTRf60bKbY" +
        "ck8LhglY9q7yLzI2RhjtsZ2rX3OTeG4h00HgHA";
      expect(() => profile.identify({ customId })).rejects.toThrow(
        new Error("Custom identifier must be a string and can’t be longer than 512 characters.")
      );
    });
  });

  describe("Migration Configuration Tests", () => {
    beforeEach(async () => {
      EventTracker.mockClear();
    });
    describe("Custom ID Migration", () => {
      beforeEach(async () => {
        const profilePersistence = await ProfilePersistence.getInstance();
        await profilePersistence.setData(ProfileKeys.InstallationID, "test_auto_installation_id");
        await profilePersistence.setData(ProfileKeys.CustomIdentifier, "test_auto_custom_identifiers");
      });
      it("Auto identify event should be sent when no specific configuration", async () => {
        const sdk = new BaseSdk();
        await sdk.setup({
          apiKey: "DEV12345",
          authKey: "1.test",
        });
        LocalEventBus.emit(LocalSDKEvent.ProjectChanged, { old: null, new: "project_1234467898" }, false);
        await Delay(100);
        const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
        const expectedTrackedEvent = expect.objectContaining({
          name: InternalSDKEvent.ProfileIdentify,
          params: {
            identifiers: {
              install_id: "test_auto_installation_id",
              custom_id: "test_auto_custom_identifiers",
            },
          },
        });
        expect(mockedEventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
      });

      it("Auto identify event should be sent with specific configuration", async () => {
        const sdk = new BaseSdk();
        await sdk.setup({
          apiKey: "DEV12345",
          authKey: "1.test",
          migrations: {
            v4: {
              customID: true,
            },
          },
        });
        LocalEventBus.emit(LocalSDKEvent.ProjectChanged, { old: null, new: "project_1234467898" }, false);
        await Delay(100);
        const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
        const expectedTrackedEvent = expect.objectContaining({
          name: InternalSDKEvent.ProfileIdentify,
          params: {
            identifiers: {
              install_id: "test_auto_installation_id",
              custom_id: "test_auto_custom_identifiers",
            },
          },
        });
        expect(mockedEventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
      });

      it("Auto identify event should NOT be sent with specific configuration", async () => {
        const sdk = new BaseSdk();
        await sdk.setup({
          apiKey: "DEV12345",
          authKey: "1.test",
          migrations: {
            v4: {
              customID: false,
            },
          },
        });
        LocalEventBus.emit(LocalSDKEvent.ProjectChanged, { old: null, new: "project_1234467898" }, false);
        await Delay(100);
        const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
        const expectedTrackedEvent = expect.objectContaining({
          name: InternalSDKEvent.ProfileIdentify,
          params: {
            identifiers: {
              install_id: "test_auto_installation_id",
              custom_id: "test_auto_custom_identifiers",
            },
          },
        });
        expect(mockedEventTracker.track).not.toHaveBeenCalledWith(expectedTrackedEvent);
      });
    });

    describe("Custom Data Migration", () => {
      beforeEach(async () => {
        const profilePersistence = await ProfilePersistence.getInstance();
        await profilePersistence.setData(ProfileKeys.UserLanguage, "de");
        await profilePersistence.setData(ProfileKeys.UserRegion, "DE");
        const userDataPersistence = await UserDataPersistence.getInstance();
        await userDataPersistence.setData("attributes", {
          age: { type: "i", value: 32 },
          car: { type: "s", value: "BMW" },
          michel: { type: "a", value: ["C'est", "le", "bresil"] },
        });
      });

      it("Profile Data Changed should be sent without specific configuration", async () => {
        const sdk = new BaseSdk();
        await sdk.setup({
          apiKey: "DEV12345",
          authKey: "1.test",
        });
        LocalEventBus.emit(LocalSDKEvent.ProjectChanged, { old: null, new: "project_1234467898" }, false);
        await Delay(100);
        const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
        const expectedTrackedEvent = expect.objectContaining({
          name: InternalSDKEvent.ProfileDataChanged,
          params: expect.objectContaining({
            language: "de",
            region: "DE",
            custom_attributes: {
              "car.s": "BMW",
              "age.i": 32,
              "michel.a": ["C'est", "le", "bresil"],
            },
          }),
        });
        expect(mockedEventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
      });
      it("Profile Data Changed should be sent with specific configuration", async () => {
        const sdk = new BaseSdk();

        await sdk.setup({
          apiKey: "DEV12345",
          authKey: "1.test",
          migrations: {
            v4: {
              customData: true,
            },
          },
        });
        LocalEventBus.emit(LocalSDKEvent.ProjectChanged, { old: null, new: "project_1234467898" }, false);
        await Delay(100);
        const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
        const expectedTrackedEvent = expect.objectContaining({
          name: InternalSDKEvent.ProfileDataChanged,
          params: expect.objectContaining({
            language: "de",
            region: "DE",
            custom_attributes: {
              "car.s": "BMW",
              "age.i": 32,
              "michel.a": ["C'est", "le", "bresil"],
            },
          }),
        });
        expect(mockedEventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
      });
      it("Profile Data Changed should NOT be sent with specific configuration", async () => {
        const sdk = new BaseSdk();
        await sdk.setup({
          apiKey: "DEV12345",
          authKey: "1.test",
          migrations: {
            v4: {
              customData: false,
            },
          },
        });
        LocalEventBus.emit(LocalSDKEvent.ProjectChanged, { old: null, new: "project_1234467898" }, false);
        await Delay(100);
        const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
        const expectedTrackedEvent = expect.objectContaining({
          name: InternalSDKEvent.ProfileDataChanged,
          params: expect.objectContaining({
            language: "de",
            region: "DE",
            custom_attributes: {
              "car.s": "BMW",
              "age.i": 32,
              "michel.a": ["C'est", "le", "bresil"],
            },
          }),
        });
        expect(mockedEventTracker.track).not.toHaveBeenCalledWith(expectedTrackedEvent);
      });
    });
  });
});
