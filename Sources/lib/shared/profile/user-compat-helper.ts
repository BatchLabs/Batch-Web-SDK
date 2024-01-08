import { isSet } from "com.batch.shared/helpers/primitive";
import { isPartialUpdateArrayObject, ProfileAttributeType, ProfileCustomDataAttributes } from "com.batch.shared/profile/profile-data-types";
import { UserAttributeType, UserDataAttributes, UserDataTagCollections } from "com.batch.shared/profile/user-data-types";

export function convertProfileDataAttributesToUserAttributes(attributes: ProfileCustomDataAttributes): UserDataAttributes {
  const userAttributes: UserDataAttributes = {};
  for (const [key, attribute] of Object.entries(attributes)) {
    if (
      attribute.type != ProfileAttributeType.ARRAY &&
      attribute.value != null &&
      !isSet(attribute.value) &&
      !isPartialUpdateArrayObject(attribute.value)
    ) {
      userAttributes[key] = {
        type: attribute.type as unknown as UserAttributeType,
        value: attribute.value,
      };
    }
  }
  return userAttributes;
}

export function convertProfileDataAttributesToUserTags(attributes: ProfileCustomDataAttributes): UserDataTagCollections {
  const tagCollections: UserDataTagCollections = {};
  for (const [key, attribute] of Object.entries(attributes)) {
    if (attribute.type == ProfileAttributeType.ARRAY && isSet(attribute.value)) {
      tagCollections[key] = attribute.value;
    }
  }
  return tagCollections;
}

export function convertProfileDataAttributesToUserPublicTags(attributes: ProfileCustomDataAttributes): { [key: string]: string[] } {
  const tagCollections: { [key: string]: string[] } = {};
  for (const [key, attribute] of Object.entries(attributes)) {
    if (attribute.type == ProfileAttributeType.ARRAY && isSet(attribute.value)) {
      tagCollections[key] = Array.from(attribute.value);
    }
  }
  return tagCollections;
}
