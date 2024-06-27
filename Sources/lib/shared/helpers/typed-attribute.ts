import { IProfileNativeOperations, IProfileOperation, ProfileDataOperation } from "com.batch.shared/profile/profile-attribute-editor";

import { BatchSDK } from "../../../public/types/public-api";

export const isTypedEventAttributeValue = (value: unknown): value is BatchSDK.EventAttributeValue => {
  return (
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof URL) &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "type") &&
    Object.prototype.hasOwnProperty.call(value, "value")
  );
};

export const isProfileTypedAttributeValue = (value: unknown): value is BatchSDK.ProfileTypedAttributeValue => {
  return (
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof URL) &&
    Object.prototype.hasOwnProperty.call(value, "type") &&
    Object.prototype.hasOwnProperty.call(value, "value")
  );
};

export function isNativeOperation(value: IProfileOperation): value is IProfileNativeOperations {
  return (
    value.operation == ProfileDataOperation.SetLanguage ||
    value.operation == ProfileDataOperation.SetRegion ||
    value.operation == ProfileDataOperation.SetEmail ||
    value.operation == ProfileDataOperation.SetEmailMarketingSubscriptionState
  );
}
