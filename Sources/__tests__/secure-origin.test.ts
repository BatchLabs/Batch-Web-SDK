/* eslint-env jest */

import isOriginSecure from "com.batch.shared/helpers/secure-origin";

test("correctly detects secure origins", () => {
  expect(isOriginSecure("https:", "foo")).toBe(true);
  expect(isOriginSecure("https:", "")).toBe(true);
  expect(isOriginSecure("file:", "")).toBe(true);
  expect(isOriginSecure("file:", "foo")).toBe(true);
  expect(isOriginSecure("wss:", "")).toBe(true);
  expect(isOriginSecure("wss:", "foo")).toBe(true);

  expect(isOriginSecure("http:", "localhost")).toBe(true);
  expect(isOriginSecure("http:", "127/8")).toBe(true);
  expect(isOriginSecure("http:", "::1/128")).toBe(true);
});

test("fails on insecure origins", () => {
  expect(isOriginSecure("http:", "foo")).toBe(false);
  expect(isOriginSecure("http:", "")).toBe(false);
  expect(isOriginSecure("http:", "test.batch.com")).toBe(false);
});
