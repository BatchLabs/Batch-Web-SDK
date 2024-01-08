/* eslint-env jest */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import EventTracker from "com.batch.shared/event/event-tracker";
import UUID from "com.batch.shared/helpers/uuid";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { ProbationManager } from "com.batch.shared/managers/probation-manager";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IndexedDbMemoryMock } from "com.batch.shared/persistence/__mocks__/indexed-db-memory-mock";
import { IComplexPersistenceProvider } from "com.batch.shared/persistence/persistence-provider";
import { UserDataPersistence } from "com.batch.shared/persistence/user-data";
import { UserCompatModule } from "com.batch.shared/profile/user-compat-module";
import { UserDataStorage } from "com.batch.shared/profile/user-data-storage";
import { MockWebserviceExecutor } from "com.batch.shared/test-utils/mock-webservice-executor";
import { IWebserviceExecutor } from "com.batch.shared/webservice/executor";
import { AttributesCheckResponse } from "com.batch.shared/webservice/responses/attributes-check-response";

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/user-data");

async function getUserModuleDependencies(): Promise<{
  probationManager: any;
  persistence: any;
  webserviceExecutor: any;
}> {
  return {
    probationManager: new ProbationManager(await ParameterStore.getInstance()),
    persistence: await UserDataPersistence.getInstance(),
    webserviceExecutor: undefined,
  };
}

async function populateUserDataStorage(): Promise<void> {
  const userDataStorage = new UserDataStorage(await UserDataPersistence.getInstance());
  userDataStorage.persistTxid(UUID());
  userDataStorage.persistVersion(2);
}

describe("User Data - Attributes check", () => {
  afterEach(async () => {
    LocalEventBus._resetForTests();
    (await (UserDataPersistence.getInstance() as unknown as Promise<IndexedDbMemoryMock>))._resetForTests();
  });

  it("schedules ATC on session start", async () => {
    class MockedUserModule extends UserCompatModule {
      public scheduleAttributesCheck: () => void;

      public constructor(
        probationManager: ProbationManager,
        persistence: IComplexPersistenceProvider,
        webserviceExecutor: IWebserviceExecutor
      ) {
        super(probationManager, webserviceExecutor, new UserDataStorage(persistence), new EventTracker(true, webserviceExecutor));
        this.scheduleAttributesCheck = jest.fn();
      }
    }

    const { probationManager, persistence, webserviceExecutor } = await getUserModuleDependencies();

    const userModuleMock = new MockedUserModule(probationManager, persistence, webserviceExecutor);
    LocalEventBus.emit(LocalSDKEvent.SessionStarted, { sessionID: UUID() }, true);
    expect(userModuleMock.scheduleAttributesCheck).toHaveBeenCalled();
  });

  it("saves the last check timestamp on success", async () => {
    const { probationManager, persistence } = await getUserModuleDependencies();
    const userDataStorage = new UserDataStorage(persistence);

    const webserviceExecutor = new MockWebserviceExecutor<AttributesCheckResponse>({
      action: "OK",
    });

    expect(await userDataStorage.getLastCheckTimestamp()).toBeUndefined();
    await populateUserDataStorage();

    const userModule = new UserCompatModule(
      probationManager,
      webserviceExecutor,
      new UserDataStorage(persistence),
      new EventTracker(true, webserviceExecutor)
    );

    await (userModule as any).checkWithServer();

    expect(await userDataStorage.getLastCheckTimestamp()).toBeDefined();
  });

  it("schedules a bump when asked", async () => {
    class MockedUserModule extends UserCompatModule {
      public scheduleBumpVersion: () => void;

      public constructor(
        probationManager: ProbationManager,
        persistence: IComplexPersistenceProvider,
        webserviceExecutor: IWebserviceExecutor
      ) {
        super(probationManager, webserviceExecutor, new UserDataStorage(persistence), new EventTracker(true, webserviceExecutor));
        this.scheduleBumpVersion = jest.fn();
      }
    }

    const { probationManager, persistence } = await getUserModuleDependencies();
    const userDataStorage = new UserDataStorage(persistence);

    const webserviceExecutor = new MockWebserviceExecutor<AttributesCheckResponse>({
      action: "BUMP",
      ver: 4,
    });

    expect(await userDataStorage.getLastCheckTimestamp()).toBeUndefined();
    await populateUserDataStorage();

    const userModule = new MockedUserModule(probationManager, persistence, webserviceExecutor);
    await (userModule as any).checkWithServer();

    expect(await userDataStorage.getLastCheckTimestamp()).toBeUndefined();
    expect(userModule.scheduleBumpVersion).toBeCalledWith(2, 4);
  });

  it("schedules a resend when asked", async () => {
    class MockedUserModule extends UserCompatModule {
      public resendAttributes: () => Promise<void>;

      public constructor(
        probationManager: ProbationManager,
        persistence: IComplexPersistenceProvider,
        webserviceExecutor: IWebserviceExecutor
      ) {
        super(probationManager, webserviceExecutor, new UserDataStorage(persistence), new EventTracker(true, webserviceExecutor));
        this.resendAttributes = jest.fn();
      }
    }

    const { probationManager, persistence } = await getUserModuleDependencies();
    const userDataStorage = new UserDataStorage(persistence);

    const webserviceExecutor = new MockWebserviceExecutor<AttributesCheckResponse>({
      action: "RESEND",
    });

    expect(await userDataStorage.getLastCheckTimestamp()).toBeUndefined();
    await populateUserDataStorage();

    const userModule = new MockedUserModule(probationManager, persistence, webserviceExecutor);
    await (userModule as any).checkWithServer();

    expect(await userDataStorage.getLastCheckTimestamp()).toBeUndefined();
    expect(userModule.resendAttributes).toBeCalled();
  });

  it("can bump version", async () => {
    class MockedUserModule extends UserCompatModule {
      public scheduleAttributesSend: () => void;
      public bumpVersion: (fromVersion: number, serverVersion: number) => Promise<void>;

      public constructor(
        probationManager: ProbationManager,
        persistence: IComplexPersistenceProvider,
        webserviceExecutor: IWebserviceExecutor
      ) {
        super(probationManager, webserviceExecutor, new UserDataStorage(persistence), new EventTracker(true, webserviceExecutor));
        this.scheduleAttributesSend = jest.fn();
      }
    }

    const { probationManager, persistence, webserviceExecutor } = await getUserModuleDependencies();
    const userDataStorage = new UserDataStorage(persistence);

    await populateUserDataStorage();

    const userModule = new MockedUserModule(probationManager, persistence, webserviceExecutor);
    await userModule.bumpVersion(2, 4);

    expect(await userDataStorage.getTxid()).toBeUndefined();
    expect(await userDataStorage.getVersion()).toEqual(5);
    expect(userModule.scheduleAttributesSend).toBeCalled();

    // Check that atomicity works: a bump request when the previous version isn't the one that the
    // current one should be ignored

    userModule.scheduleAttributesSend = jest.fn();

    await userModule.bumpVersion(2, 6);

    await userDataStorage.persistTxid(UUID());
    expect(await userDataStorage.getTxid()).toBeDefined();
    expect(await userDataStorage.getVersion()).toEqual(5);
    expect(userModule.scheduleAttributesSend).not.toBeCalled();
  });

  it("can resend attributes", async () => {
    class MockedUserModule extends UserCompatModule {
      public resendAttributes: () => Promise<void>;
      public scheduleAttributesSend: () => void;

      public constructor(
        probationManager: ProbationManager,
        persistence: IComplexPersistenceProvider,
        webserviceExecutor: IWebserviceExecutor
      ) {
        super(probationManager, webserviceExecutor, new UserDataStorage(persistence), new EventTracker(true, webserviceExecutor));
        this.scheduleAttributesSend = jest.fn();
      }
    }

    const { probationManager, persistence, webserviceExecutor } = await getUserModuleDependencies();
    const userDataStorage = new UserDataStorage(persistence);

    await populateUserDataStorage();

    const userModule = new MockedUserModule(probationManager, persistence, webserviceExecutor);
    await userModule.resendAttributes();

    expect(await userDataStorage.getTxid()).toBeUndefined();
    expect(userModule.scheduleAttributesSend).toBeCalled();
  });

  it("test trigger on project changed", async () => {
    class MockedEventCallback {
      public onProjectChanged: () => void;
      public constructor() {
        this.onProjectChanged = jest.fn();
        LocalEventBus.subscribe(LocalSDKEvent.ProjectChanged, this.onProjectChanged.bind(this));
      }
    }
    class MockedUserModule extends UserCompatModule {
      public constructor(
        probationManager: ProbationManager,
        persistence: IComplexPersistenceProvider,
        webserviceExecutor: IWebserviceExecutor
      ) {
        super(probationManager, webserviceExecutor, new UserDataStorage(persistence), new EventTracker(true, webserviceExecutor));
      }
    }

    const { probationManager, persistence } = await getUserModuleDependencies();
    const webserviceExecutor = new MockWebserviceExecutor<AttributesCheckResponse>({
      action: "OK",
      // eslint-disable-next-line @typescript-eslint/camelcase
      project_key: "project_testprojectkey1234",
    });

    await populateUserDataStorage();
    const userModule = new MockedUserModule(probationManager, persistence, webserviceExecutor);
    const mock = new MockedEventCallback();

    // Ensure event has been triggered
    await (userModule as any).checkWithServer();
    expect(mock.onProjectChanged).toHaveBeenNthCalledWith(1, { old: null, new: "project_testprojectkey1234" }, expect.anything());
  });
});
