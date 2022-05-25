/* eslint-env jest */
// @ts-nocheck

jest.mock("com.batch.shared/persistence/profile");
jest.mock("com.batch.shared/persistence/session");

import ParameterStore from "com.batch.shared/parameters/parameter-store";
import WebserviceExecutor from "com.batch.shared/webservice/executor";

const mockFetchResponse = (status: any, statusText: any, jsonResponse: any): Promise<any> => {
  const resp = {
    headers: {
      "Content-type": "application/json",
    },
    ok: status === 200,
    json: () => jsonResponse,
    text: () => jsonResponse.toString(),
    statusCode: status,
    statusText,
  };

  return new Promise(resolve => {
    process.nextTick(() => resolve(resp));
  });
};
window.fetch = jest.fn().mockImplementation(() => mockFetchResponse(200, null, { id: "1234" }));
(window as any).Headers = jest.fn().mockImplementation(obj => {
  const b = new Map();
  for (const key in obj) {
    b.set(key, obj[key]);
  }
  return b;
});

let executor: any = null;
const fakeBody = { key: "bidule" };
const mockedWS = {
  getBody: jest.fn(() => {
    return Promise.resolve(fakeBody);
  }),
  getBaseURL: jest.fn(() => "https://baseurl"),
};

beforeAll(() => {
  return ParameterStore.getInstance().then(s => {
    executor = new WebserviceExecutor("my-api-key", "myAuthKey", false, "http://my-referer", s);
  });
});

test("constuctor", () => {
  expect(executor instanceof WebserviceExecutor).toBe(true);
  expect(executor.apiKey).toBe("my-api-key");
  expect(executor.devMode).toBe(false);
  expect(executor.referrer).toBe("http://my-referer");
  expect(executor.parameterStore instanceof ParameterStore).toBe(true);
});

test("start() calls the right methods", () => {
  return executor.start(mockedWS).then(() => {
    expect(mockedWS.getBody.mock.calls.length).toBe(1);
    expect(mockedWS.getBody.mock.calls[0][0] instanceof ParameterStore).toBe(true);

    expect(mockedWS.getBaseURL.mock.calls.length).toBe(1);

    expect(fetch.mock.calls.length).toBe(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://baseurl/my-api-key");
    expect(options.headers.get("X-Batch-Auth")).toBe("myAuthKey");
    expect(options.headers.get("X-Batch-Referer")).toBe("http://my-referer");
    expect(options.body).toBe(JSON.stringify(fakeBody));
    expect(options.mode).toBe("cors");
    expect(options.method).toBe("POST");
    expect(options.cache).toBe("no-cache");
  });
});
