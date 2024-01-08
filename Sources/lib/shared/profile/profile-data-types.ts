import { isSet } from "com.batch.shared/helpers/primitive";

export enum ProfileAttributeType {
  STRING = "s",
  BOOLEAN = "b",
  INTEGER = "i",
  FLOAT = "f",
  DATE = "t",
  URL = "u",
  ARRAY = "a",
  UNKNOWN = "",
}

export enum ProfileNativeAttributeType {
  EMAIL = "email",
  EMAIL_MARKETING = "email_marketing",
  LANGUAGE = "language",
  REGION = "region",
  DEVICE_LANGUAGE = "device_language",
  DEVICE_TIMEZONE = "device_timezone",
}

export type PartialUpdateArrayObject = { $add?: Set<string>; $remove?: Set<string> };
export type ProfileDataAttribute = {
  value: string | number | boolean | Set<string> | PartialUpdateArrayObject | null;
  type: ProfileAttributeType;
};
export function isPartialUpdateArrayObject(value: unknown): value is PartialUpdateArrayObject {
  return value instanceof Object && !Array.isArray(value) && !isSet(value) && value !== null;
}

export type ProfileCustomDataAttributes = {
  [key: string]: ProfileDataAttribute;
};

export type ProfileNativeDataAttribute = {
  key: ProfileNativeAttributeType;
  value: string | null;
};
