import Event from "../event/event";
import BaseWebservice from "./base";

export class EventTrackerService extends BaseWebservice {
  private events: Event[];

  public constructor(events: Event[]) {
    super();
    this.events = events;
  }

  public getQuery(): object {
    return {
      payload: this.events.map(e => Object.assign({}, e, { date: e.date.toISOString() })),
    };
  }

  public getURLShortname(): string {
    return "ev";
  }
}
