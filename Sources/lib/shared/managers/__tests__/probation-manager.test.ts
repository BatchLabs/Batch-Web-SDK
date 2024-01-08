/* eslint-env jest */
// @ts-nocheck
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Permission } from "com.batch.dom/sdk-impl/sdk";
import { Delay } from "com.batch.shared/helpers/timed-promise";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { ProbationManager, ProbationType } from "com.batch.shared/managers/probation-manager";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IndexedDbMemoryMock } from "com.batch.shared/persistence/__mocks__/indexed-db-memory-mock";
import { ProfilePersistence } from "com.batch.shared/persistence/profile";

jest.mock("com.batch.shared/persistence/profile");

class MockedCallback {
  public onExitedProbation: ({ type: ProbationType }) => void;
  public constructor() {
    this.onExitedProbation = jest.fn();
    LocalEventBus.subscribe(LocalSDKEvent.ExitedProbation, this.onExitedProbation.bind(this));
  }
}

describe("Probation Manager", () => {
  afterEach(async () => {
    LocalEventBus._resetForTests();
    (await (ProfilePersistence.getInstance() as unknown as Promise<IndexedDbMemoryMock>))._resetForTests();
  });

  it("Test out of profile probation when logged in", async () => {
    // Init probation manager
    const probationManager = new ProbationManager(await ParameterStore.getInstance());
    const mock = new MockedCallback();
    // Ensure we are in probation
    expect(await probationManager.isInProfileProbation()).toBe(true);
    expect(await probationManager.isInPushProbation()).toBe(true);

    // Simulate user login
    probationManager.onUserLoggedIn();
    await Delay(100);

    // Ensure we are out of profile probation but still in push probation
    expect(await probationManager.isInProfileProbation()).toBe(false);
    expect(await probationManager.isInPushProbation()).toBe(true);
    expect(mock.onExitedProbation).toHaveBeenCalledWith({ type: ProbationType.Profile }, expect.anything());
  });

  it("Test out of push probation when subscription change", async () => {
    // Init probation manager
    const probationManager = new ProbationManager(await ParameterStore.getInstance());
    const mock = new MockedCallback();

    // Ensure we are in probation
    expect(await probationManager.isInProfileProbation()).toBe(true);
    expect(await probationManager.isInPushProbation()).toBe(true);

    // Simulate user login
    LocalEventBus.emit(LocalSDKEvent.SubscriptionChanged, { subscribed: true, permission: Permission.Granted }, false);
    await Delay(100);

    // Ensure we are out of profile probation but still in push probation
    expect(await probationManager.isInProfileProbation()).toBe(false);
    expect(await probationManager.isInPushProbation()).toBe(false);
    expect(mock.onExitedProbation).toHaveBeenCalledTimes(2);
    expect(mock.onExitedProbation).toHaveBeenCalledWith({ type: ProbationType.Profile }, expect.anything());
    expect(mock.onExitedProbation).toHaveBeenCalledWith({ type: ProbationType.Push }, expect.anything());
  });
});
