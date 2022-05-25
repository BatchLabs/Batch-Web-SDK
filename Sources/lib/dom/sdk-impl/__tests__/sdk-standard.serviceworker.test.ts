/* eslint-env jest */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { urlBase64ToUint8Array } from "com.batch.shared/helpers/push-helper";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

import { StandardSDK } from "../sdk-standard";

let swMock: {
  register: jest.Mock<any, any[]>;
};

beforeEach(() => {
  // JSDOM doesn't support service workers
  swMock = {
    register: jest.fn() as any,
  };
  Object.defineProperty(global.navigator, "serviceWorker", {
    configurable: true,
    value: swMock,
    writable: true,
  });
});

afterEach(() => {
  (swMock as any) = undefined;
  delete (global.navigator as any).serviceWorker;
});

it("uses an existing service worker when asked", async () => {
  const mockSWInstance = {
    active: jest.fn(),
    pushManager: jest.fn(),
  };
  swMock.register.mockImplementation(() => {
    return Promise.reject("Should not register a sw");
  });
  (swMock as any).ready = Promise.resolve(mockSWInstance);

  const batchConfig = {
    useExistingServiceWorker: true,
  } as IPrivateBatchSDKConfiguration;

  const sdk = new StandardSDK();
  await sdk["initServiceWorker"](batchConfig);
  sdk["config"] = batchConfig;

  expect(navigator.serviceWorker.register).not.toBeCalled();
  expect(sdk["worker"]).toBe(mockSWInstance.active);
  expect(sdk["pushManager"]).toBe(mockSWInstance.pushManager);
});

it("refreshes the internal service worker state using the public API", async () => {
  const mockSWInstance = {
    active: jest.fn(),
    pushManager: jest.fn(),
  };
  (swMock as any).ready = Promise.resolve(mockSWInstance);

  const batchConfig = {
    useExistingServiceWorker: true,
  } as IPrivateBatchSDKConfiguration;

  const sdk = new StandardSDK();
  await sdk["initServiceWorker"](batchConfig);
  sdk["config"] = batchConfig;

  expect(sdk["worker"]).toBe(mockSWInstance.active);
  expect(sdk["pushManager"]).toBe(mockSWInstance.pushManager);

  mockSWInstance.active = jest.fn();
  mockSWInstance.pushManager = jest.fn();

  await sdk["refreshServiceWorkerRegistration"]();

  expect(sdk["worker"]).toBe(mockSWInstance.active);
  expect(sdk["pushManager"]).toBe(mockSWInstance.pushManager);
});

describe("doesExistingSubscriptionKeyMatchCurrent tests", () => {
  const testApplicationServerKeys = {
    1: {
      b64: "BGxd5hznRisNgjcaGVNofH26rYjS_biZjTUll746hItadgeZH-ywsaPtNJtK5dK3UkrDv8yGiztNRqKcsD6Ar4I",
      array: new Uint8Array(), // Real value will come later
    },
    2: {
      b64: "BAafvpurGY78AQTBnpOtpH9NidCw4SE+pX1H/X+E7xNUrZxNyF3ZMg1wCwvPQoRsd9wJM5WpY1AdunnmkQHTEho=",
      array: new Uint8Array(),
    },
  };

  let sdk: StandardSDK;

  beforeAll(() => {
    testApplicationServerKeys[1].array = urlBase64ToUint8Array(testApplicationServerKeys[1].b64);
    testApplicationServerKeys[2].array = urlBase64ToUint8Array(testApplicationServerKeys[2].b64);
  });

  beforeEach(() => {
    sdk = new StandardSDK();
    // Avoid calling the full setup methods by injecting the values it configures
    sdk["pubKey"] = testApplicationServerKeys[1].array;
  });

  it("returns true when there is no SW implementation", async () => {
    delete (global.navigator as any).serviceWorker;
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(true);
  });

  it("returns true when it has no pubkey loaded", async () => {
    sdk["pubKey"] = undefined;
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(true);
  });

  it("returns true when there is no SW subscription", async () => {
    (swMock as any).getRegistration = () => Promise.resolve(undefined);
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(true);
  });

  it("returns true when there is no pushManager", async () => {
    (swMock as any).getRegistration = jest.fn().mockImplementation(() => Promise.resolve({}));
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(true);
    expect((swMock as any).getRegistration).toBeCalled();
  });

  it("returns true when there is no pushManager subscription", async () => {
    const registrationMock = {
      pushManager: {
        getSubscription: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
      },
    };
    (swMock as any).getRegistration = () => Promise.resolve(registrationMock);
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(true);
    expect(registrationMock.pushManager.getSubscription).toBeCalled();
  });

  it("returns true when there is no pushManager subscription applicationServerKey", async () => {
    const registrationMock = {
      pushManager: {
        getSubscription: jest.fn().mockImplementation(() =>
          Promise.resolve({
            options: {
              applicationServerKey: null,
            },
          })
        ),
      },
    };
    (swMock as any).getRegistration = () => Promise.resolve(registrationMock);
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(true);
    expect(registrationMock.pushManager.getSubscription).toBeCalled();
  });

  it("returns true when the keys match", async () => {
    const registrationMock = {
      pushManager: {
        getSubscription: jest.fn().mockImplementation(() =>
          Promise.resolve({
            options: {
              applicationServerKey: testApplicationServerKeys[1].array.buffer,
            },
          })
        ),
      },
    };
    (swMock as any).getRegistration = () => Promise.resolve(registrationMock);
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(true);
    expect(registrationMock.pushManager.getSubscription).toBeCalled();
  });

  it("returns true when the keys don't match", async () => {
    const registrationMock = {
      pushManager: {
        getSubscription: jest.fn().mockImplementation(() =>
          Promise.resolve({
            options: {
              applicationServerKey: testApplicationServerKeys[2].array.buffer,
            },
          })
        ),
      },
    };
    (swMock as any).getRegistration = () => Promise.resolve(registrationMock);
    expect(await sdk.doesExistingSubscriptionKeyMatchCurrent()).toBe(false);
    expect(registrationMock.pushManager.getSubscription).toBeCalled();
  });
});
