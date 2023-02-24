/* eslint-env jest */
import { expect, it } from "@jest/globals";
import Event from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";

it("tests private event serialization", () => {
  const expectedDate = "2020-12-01T12:13:14.156Z";
  let event = new Event(InternalSDKEvent.PushOpen, { foo: "bar" });
  event.date = new Date(expectedDate);
  expect(JSON.parse(JSON.stringify(event))).toEqual({
    id: event.id,
    name: InternalSDKEvent.PushOpen,
    date: expectedDate,
    params: {
      foo: "bar",
    },
  });

  event = new Event(InternalSDKEvent.PushOpen);
  event.date = new Date(expectedDate);
  expect(JSON.parse(JSON.stringify(event))).toEqual({
    id: event.id,
    name: InternalSDKEvent.PushOpen,
    date: expectedDate,
    params: {},
  });
});
