import { RenderEventAttributes, RenderEventAttributeValue } from "com.batch.shared/actions/contracts";
import {
  asObject,
  asString,
  asStringArray,
  isArray,
  isBoolean,
  isDate,
  isNumber,
  isString,
  isURL,
} from "com.batch.shared/helpers/primitive";

export interface TrackEvent {
  eventName: string;
  attributes: RenderEventAttributes;
}

function isEventAttributeInput(value: unknown): value is RenderEventAttributeValue {
  if (isString(value) || isBoolean(value) || isNumber(value) || isDate(value) || isURL(value) || isArray(value)) {
    return true;
  }
  return typeof value === "object" && value !== null;
}

/** Keeps the accepted attributes of a wire payload, keyed by attribute name. */
export function resolveEventAttributes(value: unknown): RenderEventAttributes {
  const attributes: RenderEventAttributes = {};
  for (const [key, attribute] of Object.entries(asObject(value))) {
    if (isEventAttributeInput(attribute)) {
      attributes[key] = attribute;
    }
  }
  return attributes;
}

export function resolveTrackEvent(args: Record<string, unknown> | undefined): TrackEvent {
  const eventName = asString(args?.["e"]);
  if (!eventName) {
    throw new Error("Cannot perform action: empty event name");
  }

  const label = asString(args?.["l"]);
  const eventAttributes = resolveEventAttributes(args?.["a"]);
  const tags = asStringArray(args?.["t"]);
  const attributes = {
    ...eventAttributes,
    ...(label ? { $label: label } : {}),
    ...(tags.length > 0 ? { $tags: tags } : {}),
  };

  return { eventName, attributes };
}
