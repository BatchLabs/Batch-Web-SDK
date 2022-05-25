/* eslint-env jest */
// @ts-nocheck

import { EventBus } from "com.batch.shared/local-event-bus";

const bus = new EventBus();

const allEventListener = jest.fn();
const testEventListner = jest.fn();
const lateTestEventListner = jest.fn();

test("we can subscribe listener to bus", () => {
  expect(() => bus.subscribe("*", allEventListener)).not.toThrow();
  expect(() => bus.subscribe("test", testEventListner)).not.toThrow();
  expect(() => bus.subscribe("test", "test")).toThrow();
  expect(bus.listeners.get("*").length).toBe(1);
  expect(bus.listeners.get("test").length).toBe(1);
});

test("the method getListenersFor works", () => {
  expect(bus.getListenersFor("*").length).toBe(1);
  expect(bus.getListenersFor("*")[0]).toBe(allEventListener);
  expect(bus.getListenersFor("test").length).toBe(1);
  expect(bus.getListenersFor("test")[0]).toBe(testEventListner);
  expect(bus.getListenersFor("not created yet").length).toBe(0);
});

test("the right listeners are notified", () => {
  bus.emit("*");
  expect(allEventListener.mock.calls.length).toBe(0);
  expect(testEventListner.mock.calls.length).toBe(0);
  bus.emit("not test");
  expect(allEventListener.mock.calls.length).toBe(1);
  bus.emit("test");
  expect(allEventListener.mock.calls.length).toBe(2);
  expect(testEventListner.mock.calls.length).toBe(1);
});

test("if last event is the same, dedupe", () => {
  bus.emit("test");
  expect(allEventListener.mock.calls.length).toBe(2);
  expect(testEventListner.mock.calls.length).toBe(1);
  bus.emit("test", { notsame: true });
  expect(allEventListener.mock.calls.length).toBe(3);
  expect(testEventListner.mock.calls.length).toBe(2);
});

test("late to the party listener can catch up", () => {
  bus.subscribe("test", lateTestEventListner);
  expect(lateTestEventListner.mock.calls.length).toBe(2);
});

test("do not dedupe if not last event", () => {
  bus.emit("test");
  expect(allEventListener.mock.calls.length).toBe(4);
  expect(testEventListner.mock.calls.length).toBe(3);
  expect(lateTestEventListner.mock.calls.length).toBe(3);
});
