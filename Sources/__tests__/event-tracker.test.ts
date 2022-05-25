/* eslint-env jest */
jest.mock("../config");

import Event from "com.batch.shared/event/event";
import EventTracker from "com.batch.shared/event/event-tracker";
import { Delay } from "com.batch.shared/helpers/timed-promise";

const fakeExecutor = {
  start: jest.fn(() => Promise.resolve(true)),
};
const tracker = new EventTracker(false, fakeExecutor);
// FIXME: Rewrite tests so that they work with a proper debounce delay
(tracker as any).debounceDelay = 0;
const event = new Event("test");

test("can enqueue an event", () => {
  tracker.track(event);
  expect(tracker.buffer.length).toBe(1);
  return Delay(1).then(() => {
    expect(fakeExecutor.start.mock.calls.length).toBe(1);
    expect(tracker.buffer.length).toBe(0);
  });
});

test("can batch events", () => {
  fakeExecutor.start = jest.fn(() => Promise.resolve(true));
  tracker.track(event);
  tracker.track(event);
  tracker.track(event);
  expect(tracker.buffer.length).toBe(3);
  return Delay(10).then(() => {
    expect(fakeExecutor.start.mock.calls.length).toBe(1);
    expect(fakeExecutor.start.mock.calls[0][0].events.length).toBe(3);
    expect(tracker.buffer.length).toBe(0);
  });
});

test("can group the events in bundles of 30", () => {
  fakeExecutor.start = jest.fn(() => Promise.resolve(true));
  for (let index = 0; index < 31; index++) {
    tracker.track(event);
  }
  return Delay(10).then(() => {
    expect(fakeExecutor.start.mock.calls.length).toBe(1);
    expect(fakeExecutor.start.mock.calls[0][0].events.length).toBe(30);
  });
});

test("keeps the event enqueued for retry on failure", () => {
  fakeExecutor.start = jest.fn(() => Promise.reject(new Error("Dummy test error")));
  tracker.track(event);
  expect(fakeExecutor.start.mock.calls.length).toBe(0);
  expect(tracker.buffer.length).toBe(1);
  return Delay(1)
    .then(() => {
      // first attempt, 1 call
      expect(fakeExecutor.start.mock.calls.length).toBe(1);
      expect(tracker.buffer.length).toBe(1);
      return Delay(40);
    })
    .then(() => {
      // second attempt, 2 calls
      // expect(fakeExecutor.start.mock.calls.length).toBe(2);
      // expect(tracker.buffer.length).toBe(1);
      return Delay(40);
    })
    .then(() => {
      // last attempt, 3 calls
      // expect(fakeExecutor.start.mock.calls.length).toBe(3);
      // expect(tracker.buffer.length).toBe(1);
      return Delay(10);
    })
    .then(() => {
      // there should not be more attempts
      expect(fakeExecutor.start.mock.calls.length).toBe(3);
      expect(tracker.buffer.length).toBe(1);
    });
});
