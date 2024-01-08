/* eslint-env jest */
// @ts-nocheck

jest.mock("com.batch.shared/persistence/profile");

import ParameterStore from "com.batch.shared/parameters/parameter-store";
import WebserviceBase from "com.batch.shared/webservice/base";

import { SDK_API_LVL } from "../config";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BatchPackage = require("../../package.json");

const wsb = new WebserviceBase();
wsb.getURLShortname = jest.fn().mockReturnValue("test");

let store = null;
beforeAll(() => {
  return ParameterStore.getInstance().then(s => {
    store = s;
  });
});

test("getHeaders", () => {
  return wsb.getHeaders(store).then(headers => {
    expect(headers).toHaveProperty("cus");
    expect(headers).toHaveProperty("di");
    expect(headers).toHaveProperty("lvl", `${SDK_API_LVL}`);
    expect(headers).toHaveProperty("dtz");
    expect(headers).toHaveProperty("da");
    expect(headers).toHaveProperty("dla");
    expect(headers).toHaveProperty("profile_probation");
    expect(headers).toHaveProperty("data_collection");
    expect(headers["data_collection"]).toHaveProperty("geoip");
  });
});

test("getBaseURL", () => {
  expect(wsb.getBaseURL()).toBe(`https://ws.secure/${BatchPackage.version}/test`);
});
