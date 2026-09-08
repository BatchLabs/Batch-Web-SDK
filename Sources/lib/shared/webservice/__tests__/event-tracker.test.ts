import { ISerializableEvent } from "com.batch.shared/event/serializable-event";
import { EventTrackerService } from "com.batch.shared/webservice/event-tracker";

function makeEvent(id: string): ISerializableEvent {
  return { id, name: "_MESSAGING", toJSON: () => ({ id }) };
}

describe("EventTrackerService batch exposure", () => {
  test("getQuery hands out a copy, not the batch itself", () => {
    const batch = [makeEvent("a"), makeEvent("b")];
    const service = new EventTrackerService(batch);

    const payload = (service.getQuery() as { payload: ISerializableEvent[] }).payload;

    expect(payload).not.toBe(batch);
    expect(payload).toEqual(batch);
  });

  test("mutating the getQuery payload leaves the batch untouched", () => {
    const batch = [makeEvent("a"), makeEvent("b")];
    const service = new EventTrackerService(batch);

    const payload = (service.getQuery() as { payload: ISerializableEvent[] }).payload;
    payload.push(makeEvent("injected"));
    payload[0] = makeEvent("tampered");

    expect(service.getEvents().map(event => event.id)).toEqual(["a", "b"]);
  });

  test("getEvents carries the batch the tracker handed over", () => {
    const batch = [makeEvent("a")];
    expect(new EventTrackerService(batch).getEvents()).toEqual(batch);
  });
});
