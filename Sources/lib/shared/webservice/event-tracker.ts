import { ISerializableEvent } from "com.batch.shared/event/serializable-event";

import BaseWebservice from "./base";

export class EventTrackerService extends BaseWebservice {
  private events: ISerializableEvent[];

  public constructor(events: ISerializableEvent[]) {
    super();
    this.events = events;
  }

  public getQuery(): object {
    return {
      payload: this.events,
    };
  }

  public getURLShortname(): string {
    return "ev";
  }
}
