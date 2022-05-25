import { IEventDataInternalRepresentation } from "com.batch.shared/user/event-data";

import EventPublic from "./event-public";

export default class EventPublicReplayed extends EventPublic {
  public constructor(name: string, eventData?: IEventDataInternalRepresentation) {
    super(name, eventData);

    if (eventData != null && typeof eventData !== "object") {
      throw new Error("Error while constructing Event: 'eventData' is optional but must be an object if provided");
    }

    this.params = this.getParams(eventData);
  }

  public getParams(data?: IEventDataInternalRepresentation): unknown {
    const params = {
      label: data?.label,
      replay: true,
      attributes: data?.attributes,
      tags: data?.tags,
    };

    return params;
  }

  public static fromJSON(json: string): EventPublicReplayed[] {
    const eventsParsed = JSON.parse(json);

    const eventsPublic: EventPublicReplayed[] = [];

    for (const eventParsed of eventsParsed) {
      const e = new EventPublicReplayed(eventParsed.name, eventParsed.params);
      e.date = new Date(eventParsed.date);
      e.name = eventParsed.name;
      eventsPublic.push(e);
    }

    return eventsPublic;
  }
}
