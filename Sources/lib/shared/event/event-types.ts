import { isString } from "com.batch.shared/helpers/primitive";
import { isTypedEventAttributeValue } from "com.batch.shared/helpers/typed-attribute";

import { BatchSDK } from "../../../public/types/public-api";

export type ObjectEventAttribute = {
  [key: string]: string | boolean | number | URL | Date | Array<string | ObjectEventAttribute> | ObjectEventAttribute;
};
export type EventAttributeType = string | boolean | number | URL | Date | Array<string | ObjectEventAttribute> | ObjectEventAttribute;

export function isObjectAttribute(value: unknown): value is ObjectEventAttribute {
  return value instanceof Object && !Array.isArray(value) && value !== null && !isTypedEventAttributeValue(value);
}
export function isStringArray(value: Array<unknown>): value is Array<string> {
  return value.every(it => isString(it));
}
export function isObjectArray(value: Array<unknown>): value is Array<ObjectEventAttribute> {
  return value.every(it => isObjectAttribute(it));
}
export function isExplicitTypedObjectArray(value: Array<unknown>): value is Array<BatchSDK.EventAttributeValue> {
  return value.every(it => isTypedEventAttributeValue(it));
}

export enum TypedEventAttributeType {
  STRING = "s",
  BOOLEAN = "b",
  INTEGER = "i",
  FLOAT = "f",
  DATE = "t",
  URL = "u",
  ARRAY = "a",
  OBJECT = "o",
}
export interface IEventDataInternalRepresentation {
  tags: string[];
  label?: string;
  attributes: { [key: string]: EventAttributeType };
}
