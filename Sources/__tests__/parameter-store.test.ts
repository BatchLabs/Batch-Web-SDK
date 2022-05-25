/* eslint-env jest */
// @ts-nocheck

jest.mock("com.batch.shared/persistence/profile");

import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";

let store = null;

beforeAll(() => {
  return ParameterStore.getInstance().then(s => {
    store = s;
  });
});

test("can get a single param", () => {
  return store.getParameterValue(keysByProvider.system.SDKAPILevel).then(v => expect(v).toEqual("1"));
});

test("can get multiple params", done => {
  store
    .getParametersValues([keysByProvider.system.SDKAPILevel, keysByProvider.system.DeviceDate])
    .then(response => {
      expect(response[keysByProvider.system.SDKAPILevel]).toBe("1");
      expect(typeof response.da).toBe("string");
      return done();
    })
    .catch(error => done(error));
});

test("can write a param, and get the same value", done => {
  store
    .setParameterValue(keysByProvider.profile.CustomIdentifier, "michel@batch.com")
    .then(() => {
      ParameterStore.getInstance("memory")
        .then(sameInstance => {
          expect(sameInstance).toBe(store);
          sameInstance
            .getParameterValue(keysByProvider.profile.CustomIdentifier)
            .then(cid => {
              expect(cid).toBe("michel@batch.com");
              return done();
            })
            .catch(error => done(error));
        })
        .catch(error => done(error));
    })
    .catch(error => done(error));
});
