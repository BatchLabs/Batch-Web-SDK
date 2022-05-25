/* eslint-env jest */
// @ts-nocheck

import Event from "com.batch.shared/event/event";

test("new Event throws when name is not provided or not a string", () => {
  expect(() => new Event()).toThrow();
  expect(() => new Event(2)).toThrow();
  expect(() => new Event({})).toThrow();
});

test("new Event throws whsen object is not an object", () => {
  expect(() => new Event("ssds", "sdsds")).toThrow();
  expect(() => new Event("ssds", "")).toThrow();
  expect(() => new Event("ssds", true)).toThrow();
  expect(() => new Event("ssds", {})).not.toThrow();
});

test("new event has an uc name, an uuid and a date", () => {
  const e = new Event("toto");
  expect(e.name).toBe("TOTO");
  expect(e.date instanceof Date).toBe(true);
  expect(e.id.length).toBe(36);
});
