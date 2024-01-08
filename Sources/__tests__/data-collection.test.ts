/* eslint-env jest */
// @ts-nocheck

import { expect, jest } from "@jest/globals";

import BaseSdk from "../lib/dom/sdk-impl/sdk-base";
import { fillDefaultDataCollectionConfiguration, serializeDataCollectionConfig } from "../lib/shared/data-collection";
import { InternalSDKEvent } from "../lib/shared/event/event-names";
import EventTracker from "../lib/shared/event/event-tracker";
import { ProfileKeys } from "../lib/shared/parameters/keys.profile";
import { ProfilePersistence } from "../lib/shared/persistence/profile";
jest.mock("com.batch.shared/persistence/profile");
jest.mock("../lib/shared/event/event-tracker");

describe("Data Collection configuration Tests", () => {
  it("Test default data collection cases", () => {
    const defaultDataCollection = {
      geoIP: false,
    };
    // When given conf is null, default conf is returned
    expect(fillDefaultDataCollectionConfiguration(null)).toEqual(defaultDataCollection);

    // When given conf is undefined, default conf is returned
    expect(fillDefaultDataCollectionConfiguration(undefined)).toEqual(defaultDataCollection);

    // When given conf is empty, default conf is returned
    expect(fillDefaultDataCollectionConfiguration({})).toEqual(defaultDataCollection);

    // When a conf has been set up, default conf is NOT returned
    expect(fillDefaultDataCollectionConfiguration({ geoIP: true })).toEqual({ geoIP: true });
  });
  it("Test data collection serialization", () => {
    expect(serializeDataCollectionConfig({ geoIP: true })).toEqual({ geoip: true });
  });
});

describe("Event DataCollectionChanged Tests", () => {
  beforeEach(() => {
    EventTracker.mockClear();
  });
  it("Should not be triggered when lastConfig is null", async () => {
    const sdk = new BaseSdk();
    await sdk.setup({
      apiKey: "DEV12345",
      authKey: "1.test",
      defaultDataCollection: {
        geoIP: false,
      },
    });
    const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
    const expectedTrackedEvent = expect.objectContaining({
      name: InternalSDKEvent.DataCollectionChanged,
    });
    expect(mockedEventTracker.track).not.toHaveBeenCalledWith(expectedTrackedEvent);
  });

  it("Should be triggered with new default data collection settings", async () => {
    const sdk = new BaseSdk();
    const profilePersistence = await ProfilePersistence.getInstance();
    await profilePersistence.setData(ProfileKeys.LastConfiguration, {
      defaultDataCollection: {
        geoIP: false,
      },
    });
    await sdk.setup({
      apiKey: "DEV12345",
      authKey: "1.test",
      defaultDataCollection: {
        geoIP: true,
      },
    });
    const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
    const expectedTrackedEvent = expect.objectContaining({
      name: InternalSDKEvent.DataCollectionChanged,
      params: { geoip: true },
    });
    expect(mockedEventTracker.track).toHaveBeenCalledWith(expectedTrackedEvent);
  });

  it("Should not be triggered when data collection settings has not changed", async () => {
    const sdk = new BaseSdk();
    const profilePersistence = await ProfilePersistence.getInstance();
    await profilePersistence.setData(ProfileKeys.LastConfiguration, {
      defaultDataCollection: {
        geoIP: true,
      },
    });
    await sdk.setup({
      apiKey: "DEV12345",
      authKey: "1.test",
      defaultDataCollection: {
        geoIP: true,
      },
    });
    const mockedEventTracker: EventTracker = EventTracker.mock.instances[0];
    const expectedTrackedEvent = expect.objectContaining({
      name: InternalSDKEvent.DataCollectionChanged,
    });
    expect(mockedEventTracker.track).not.toHaveBeenCalledWith(expectedTrackedEvent);
  });
});
