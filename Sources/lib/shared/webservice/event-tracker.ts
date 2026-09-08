import { ISerializableEvent } from "com.batch.shared/event/serializable-event";

import BaseWebservice from "./base";

export class EventTrackerService extends BaseWebservice {
  private readonly events: ReadonlyArray<ISerializableEvent>;

  public constructor(events: ISerializableEvent[]) {
    super();
    this.events = events;
  }

  // Returns the batch this WS carries, for a transport that builds its own envelope instead of the keyed body.
  public getEvents(): ReadonlyArray<ISerializableEvent> {
    return this.events;
  }

  public getQuery(): object {
    return {
      payload: [...this.events],
    };
  }

  public getURLShortname(): string {
    return "ev";
  }
}
