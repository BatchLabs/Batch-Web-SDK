/* eslint-env jest */
import { expect, it } from "@jest/globals";
import Event from "com.batch.shared/event/event";
import { EventData } from "com.batch.shared/event/event-data";

import { PublicEvent } from "../public-event";

it("tests public event serialization", () => {
  const expectedDate = "2020-12-01T12:13:14.156Z";
  let event = new PublicEvent("test_event", true);
  event.date = new Date(expectedDate);
  expect(JSON.parse(JSON.stringify(event))).toEqual({
    id: event.id,
    name: "E.TEST_EVENT",
    date: expectedDate,
    params: {
      replay: false,
      installInProbation: true,
    },
  });

  event = new PublicEvent("test_event", false);
  event.date = new Date(expectedDate);
  expect(JSON.parse(JSON.stringify(event))).toEqual({
    id: event.id,
    name: "E.TEST_EVENT",
    date: expectedDate,
    params: {
      replay: false,
      installInProbation: false,
    },
  });
});

it("tests public event data serialization", () => {
  const expectedDate = "2020-12-01T12:13:14.156Z";
  let event = new PublicEvent("test_event", true, new EventData());
  event.date = new Date(expectedDate);
  expect(JSON.parse(JSON.stringify(event))).toEqual({
    id: event.id,
    name: "E.TEST_EVENT",
    date: expectedDate,
    params: {
      replay: false,
      installInProbation: true,
      attributes: {},
      tags: [],
    },
  });

  const eventData = new EventData({
    attributes: {
      TESTstring: "foobar",
      TESTnum: 2,
      $label: "foolabel",
      $tags: ["TAG1", "tag2"],
    },
  });
  event = new PublicEvent("test_event", false, eventData);
  event.date = new Date(expectedDate);
  expect(JSON.parse(JSON.stringify(event))).toEqual({
    id: event.id,
    name: "E.TEST_EVENT",
    date: expectedDate,
    params: {
      replay: false,
      installInProbation: false,
      label: "foolabel",
      attributes: {
        "teststring.s": "foobar",
        "testnum.i": 2,
      },
      tags: ["tag1", "tag2"],
    },
  });
});
