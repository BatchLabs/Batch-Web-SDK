// @ts-nocheck

import Event from "com.batch.shared/event/event";

test("new Event throws when name is not provided or not a string", () => {
  expect(() => new Event()).toThrow("'name' is required and should be a string");
  expect(() => new Event(2)).toThrow("'name' is required and should be a string");
  expect(() => new Event({})).toThrow("'name' is required and should be a string");
});

test("new Event throws whsen object is not an object", () => {
  expect(() => new Event("ssds", "sdsds")).toThrow("'params' is optional but must be an object if provided");
  expect(() => new Event("ssds", "")).toThrow("'params' is optional but must be an object if provided");
  expect(() => new Event("ssds", true)).toThrow("'params' is optional but must be an object if provided");
  expect(() => new Event("ssds", {})).not.toThrow();
});

test("new event has an uc name, an uuid and a date", () => {
  const e = new Event("toto");
  expect(e.name).toBe("TOTO");
  expect(e.date instanceof Date).toBe(true);
  expect(e.id.length).toBe(36);
});
