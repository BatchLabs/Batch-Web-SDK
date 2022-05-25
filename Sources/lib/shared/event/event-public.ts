import { IEventDataInternalRepresentation } from "com.batch.shared/user/event-data";

import UUID from "../helpers/uuid";

export default class EventPublic {
  // Event UUID
  public id: string;

  // Event name
  public name: string;

  // UTC Date
  public date: Date;

  // Additional data
  public params: unknown;

  public constructor(name: string, eventData?: IEventDataInternalRepresentation) {
    if (typeof name !== "string") {
      throw new Error("Error while constructing Event: 'name' is required and should be a string");
    }

    this.id = UUID();
    this.name = `E.${name.toUpperCase()}`;
    this.date = new Date();

    if (eventData != null && typeof eventData !== "object") {
      throw new Error("Error while constructing Event: 'eventData' is optional but must be an object if provided");
    }

    this.params = this.getParams(eventData);
  }

  public getParams(data?: IEventDataInternalRepresentation): unknown {
    const params = {
      label: data?.label,
      replay: false,
      attributes: data?.attributes,
      tags: data?.tags,
    };

    return params;
  }
}
