import { Consts } from "com.batch.shared/constants/user";
import { IEventDataInternalRepresentation } from "com.batch.shared/event/event-types";
import { isString } from "com.batch.shared/helpers/primitive";

import UUID from "../helpers/uuid";
import { ISerializableEvent } from "./serializable-event";

export class PublicEvent implements ISerializableEvent {
  // Event UUID
  public id: string;

  // Event name
  public name: string;

  // UTC Date
  public date: Date;

  // Additional data
  public data?: IEventDataInternalRepresentation;

  // Was the user in probation when this was tracked?
  public isInProbation: boolean;

  public constructor(name: string, isUserInProbation: boolean, eventData?: IEventDataInternalRepresentation) {
    if (!isString(name) || !Consts.EventNameRegex.test(name)) {
      throw new Error(`
        Invalid event name. Please make sure that the name is made of letters, 
      underscores and numbers only (a-zA-Z0-9_). It also can't be longer than 30 characters. Ignoring event 
        ${name}.`);
    }

    this.id = UUID();
    this.name = `E.${name.toUpperCase()}`;
    this.date = new Date();

    if (eventData != null && typeof eventData !== "object") {
      throw new Error("Error while constructing Event: 'eventData' is optional but must be an object if provided");
    }

    this.data = eventData;
    this.isInProbation = isUserInProbation;
  }

  public getSerializedParams(): unknown {
    const params = {
      label: this.data?.label,
      replay: false,
      installInProbation: this.isInProbation,
      attributes: this.data?.attributes,
      tags: this.data?.tags,
    };

    return params;
  }

  public toJSON(): unknown {
    return {
      id: this.id,
      name: this.name,
      date: this.date.toISOString(),
      params: this.getSerializedParams(),
    };
  }
}
