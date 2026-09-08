jest.mock("../config");

import Event from "com.batch.shared/event/event";
import EventTracker from "com.batch.shared/event/event-tracker";
import { Delay } from "com.batch.shared/helpers/timed-promise";

import { ISerializableEvent } from "../lib/shared/event/serializable-event";

const fakeExecutor = {
  start: jest.fn(() => Promise.resolve(true)),
};
const tracker = new EventTracker(fakeExecutor);
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

const inFlightTracker = (): { start: jest.Mock; tracker: EventTracker } => {
  const start = jest.fn(() => Promise.resolve(true));
  return { start, tracker: new EventTracker({ start }) };
};

test("flush sends a freshly tracked event while an attempt is already in flight", () => {
  const { start, tracker: flushTracker } = inFlightTracker();

  flushTracker.track(new Event("first"));
  flushTracker.flush();
  expect(start.mock.calls.length).toBe(1);

  flushTracker.track(new Event("second"));
  flushTracker.flush();

  expect(start.mock.calls.length).toBe(2);
  expect(start.mock.calls[1][0].events.map((sent: ISerializableEvent) => sent.name)).toEqual(["SECOND"]);
});

test("flush emits no request on an empty buffer", () => {
  const { start, tracker: emptyTracker } = inFlightTracker();

  emptyTracker.flush();

  expect(start.mock.calls.length).toBe(0);
});

test("a forced flush and the in-flight attempt carry disjoint batches", () => {
  const { start, tracker: disjointTracker } = inFlightTracker();

  disjointTracker.track(new Event("first"));
  disjointTracker.flush();
  disjointTracker.track(new Event("second"));
  disjointTracker.flush();

  const sentIds: string[] = [];
  start.mock.calls.forEach(call => {
    call[0].events.forEach((sent: ISerializableEvent) => sentIds.push(sent.id));
  });

  expect(sentIds.length).toBe(2);
  expect(sentIds[0]).not.toBe(sentIds[1]);
});

test("flush drains the events left over the batch limit", () => {
  const { start, tracker: overflowTracker } = inFlightTracker();
  for (let index = 0; index < 31; index++) {
    overflowTracker.track(new Event("overflow"));
  }

  overflowTracker.flush();

  expect(start.mock.calls.length).toBe(2);
  expect(start.mock.calls[0][0].events.length).toBe(30);
  expect(start.mock.calls[1][0].events.length).toBe(1);
});

test("flush sends buffered events immediately, bypassing the debounce", () => {
  const executor = { start: jest.fn(() => Promise.resolve(true)) };
  const debouncedTracker = new EventTracker(executor);
  debouncedTracker.track(event);
  expect(executor.start.mock.calls.length).toBe(0);

  debouncedTracker.flush();
  expect(executor.start.mock.calls.length).toBe(1);
  return Delay(1).then(() => {
    expect(debouncedTracker.buffer.length).toBe(0);
  });
});
