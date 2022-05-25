import UUID from "../helpers/uuid";
import { InternalSDKEvent } from "./event-names";

export default class Event {
  // Event UUID
  public id: string;

  // Event name
  public name: string;

  // UTC Date
  public date: Date;

  // Additional data
  public params: unknown;

  public constructor(name: InternalSDKEvent, params?: unknown | undefined) {
    if (typeof name !== "string") {
      throw new Error("Error while constructing Event: 'name' is required and should be a string");
    }

    this.id = UUID();
    this.name = name.toUpperCase();
    this.date = new Date();

    if (params != null && typeof params !== "object") {
      throw new Error("Error while constructing Event: 'params' is optional but must be an object if provided");
    }

    this.params = params || {};
  }
}
