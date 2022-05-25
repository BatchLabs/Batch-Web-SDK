import { BatchSDK } from "public/types/public-api";

export const isTypedAttributeValue = (value: unknown): value is BatchSDK.UserAttributeValue | BatchSDK.EventAttributeValue => {
  return (
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof URL) &&
    Object.prototype.hasOwnProperty.call(value, "type") &&
    Object.prototype.hasOwnProperty.call(value, "value")
  );
};
