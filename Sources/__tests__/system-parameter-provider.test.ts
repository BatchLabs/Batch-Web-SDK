/* eslint-env jest */
// @ts-nocheck

jest.mock("../config");

import { SystemKeys } from "com.batch.shared/parameters/keys.system";
import SystemParameterProvider from "com.batch.shared/parameters/system-parameter-provider";

const provider = new SystemParameterProvider();
/* really useful test, for the beauty of it */
test("resolves to the current sdk api lvl", () => {
  return provider.getParameterForKey(SystemKeys.SDKAPILevel).then(apilvl => {
    expect(apilvl).toBe(2);
  });
});

test("resolves to a type date for da", () => {
  return provider.getParameterForKey(SystemKeys.DeviceDate).then(dd => {
    expect(typeof dd).toBe("string");
  });
});

test("throws when passing an unknown key", () => {
  return provider.getParameterForKey("toto").then(
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {},
    err => {
      expect(err.message).toBe("toto is not a managed system key");
    }
  );
});
