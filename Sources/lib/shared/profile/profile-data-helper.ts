import { Consts } from "com.batch.shared/constants/user";
import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { isArray, isSet, isString } from "com.batch.shared/helpers/primitive";
import { Log } from "com.batch.shared/logger";
import { isPartialUpdateArrayObject, ProfileNullableStringArrayAttribute } from "com.batch.shared/profile/profile-data-types";

const logModuleName = "Profile Attribute Editor";

/**
 * Helper method to validate an attribute's key
 *
 * @return true if key is valid, else log a warning message and return false
 * @param key The attribute's key
 * @private
 */
export function isValidAttributeKey(key: string): boolean {
  if (!isString(key)) {
    Log.warn(logModuleName, "key must be a string.");
    return false;
  }
  if (!Consts.AttributeKeyRegexp.test(key || "")) {
    Log.warn(
      logModuleName,
      `Invalid key. Please make sure that the key is made of letters, 
      underscores and numbers only (a-zA-Z0-9_). It also can't be longer than 30 characters. Ignoring attribute 
        ${key}.`
    );
    return false;
  }
  return true;
}

/**
 * Helper method to validate a string value
 *
 * @param value The string value to validate
 * @param key The attribute's key'
 */
export function isValidStringValue(value: string, key?: string): boolean {
  if (value.length === 0 || value.length > Consts.AttributeStringMaxLengthCEP) {
    Log.warn(
      logModuleName,
      `String attributes can't be empty or longer than ${Consts.AttributeStringMaxLengthCEP}
            characters. Ignoring attribute ${key}.`
    );
    return false;
  }
  return true;
}

/**
 * Helper method to validate an array of string values
 *
 * @param value The array of string values to validate
 * @param key The attribute's key
 */
export function isValidStringArrayValue(value: string[], key: string): boolean {
  if (!isArray(value)) {
    Log.warn(logModuleName, `Value must be an array of string. Ignoring attribute ${key}`);
    return false;
  }
  if (value.length === 0 || value.length > Consts.MaxEventArrayItems) {
    Log.warn(
      logModuleName,
      `Array of string attributes must not be empty or longer than ${Consts.MaxEventArrayItems}. Ignoring attribute ${key}`
    );
    return false;
  }
  if (!value.every(it => isValidStringValue(it))) {
    Log.warn(
      logModuleName,
      `Array of string attributes must only have values of type String 
        and must respect the string attribute limitations. Ignoring attribute ${key}`
    );
    return false;
  }
  return true;
}

/**
 * Helper method to validate and normalize a topic preference
 *
 * @param value The topic preference to validate and normalize
 * @returns The normalized topic preference
 */
export function validateAndNormalizeTopic(value: string): string {
  if (value.length === 0 || value.length > Consts.TopicPreferenceMaxLength) {
    throw new Error(`TopicPreference value can't be empty or longer than ${Consts.TopicPreferenceMaxLength} characters.`);
  }
  const normalizedValue = value.toLowerCase();
  if (!Consts.TopicPreferenceRegexp.test(normalizedValue)) {
    throw new Error(`TopicPreference value must respect the following pattern: ${Consts.TopicPreferenceRegexp.source}.`);
  }
  return normalizedValue;
}

/**
 * Helper method to validate and normalize an array of topic preferences
 *
 * @param value The array of topic preferences to validate and normalize
 */
export function validateAndNormalizeTopicPreferences(value: string[]): string[] {
  if (!isArray(value)) {
    throw new Error("TopicPreferences must be an array of string.");
  }
  if (value.length === 0 || value.length > Consts.MaxEventArrayItems) {
    throw new Error(`TopicPreferences must not be empty or longer than ${Consts.MaxEventArrayItems}.`);
  }
  return value.map(it => validateAndNormalizeTopic(it));
}

/**
 * Helper method to validate an updated topic preferences attribute.
 *
 * @param topics The updated topic preferences attribute
 */
export function validateUpdatedTopicPreferences(topics: ProfileNullableStringArrayAttribute): boolean {
  if (!topics) {
    return true;
  }
  if (isSet(topics)) {
    return topics.size <= Consts.MaxTopicPreferenceItems;
  }
  if (isPartialUpdateArrayObject(topics)) {
    const addedTopics = topics.$add ? topics.$add.size : 0;
    const removedTopics = topics.$remove ? topics.$remove.size : 0;
    return addedTopics <= Consts.MaxTopicPreferenceItems && removedTopics <= Consts.MaxTopicPreferenceItems;
  }
  return false;
}

/**
 * Helper method to add values to an array attribute.
 *
 * There are many scenarios to handle:
 * - The attribute already exists and is a Set
 * - The attribute already exists and is a Partial Update object ($add/$remove)
 * - The attribute already exists and is null (meaning the attribute has been explicitly removed)
 * - The attribute doesn't exist yet
 *
 * @param values The values to add to the array
 * @param targetAttribute The attribute to add the values to.
 * Null if the attribute should be deleted. Undefined if the target doesn't exist.
 * @param compatModeEnabled Whether the Mobile Engagement Platform (MEP) compatibility mode is enabled or not
 * @returns The updated attribute value, or a new Set if the attribute didn't exist yet.
 */
export function addToArray(
  values: string[],
  targetAttribute: ProfileNullableStringArrayAttribute | undefined | null,
  compatModeEnabled: boolean
): ProfileNullableStringArrayAttribute {
  // Case: Array attribute already exists and is a Set
  if (targetAttribute && isSet(targetAttribute)) {
    const updatedAttribute = new Set(targetAttribute);
    values.forEach(updatedAttribute.add, updatedAttribute);
    return updatedAttribute;
  }
  // Case: Array attribute already exists and is a Partial Update object ($add/$remove)
  else if (targetAttribute && isPartialUpdateArrayObject(targetAttribute)) {
    const updatedAttribute = deepClone(targetAttribute);
    if (updatedAttribute.$add) {
      values.forEach(updatedAttribute.$add.add, updatedAttribute.$add);
    } else {
      updatedAttribute.$add = new Set(values);
    }
    return updatedAttribute;
  }
  // Case: Array attribute already exists and is null
  else if (targetAttribute === null) {
    return new Set(values);
  }
  // Case: Array attribute doesn't exist
  else {
    return compatModeEnabled ? new Set(values) : { $add: new Set(values) };
  }
}

/**
 * Helper method to remove values from an array attribute.
 *
 * There are many scenarios to handle:
 * - The attribute already exists and is a Set
 * - The attribute already exists and is a Partial Update object ($add/$remove)
 * - The attribute already exists and is null (meaning the attribute has been explicitly removed)
 * - The attribute doesn't exist yet
 *
 * @param values The values to remove from the array
 * @param targetAttribute The attribute to remove the values from.
 * Null if the attribute should be deleted. Undefined if the target doesn't exist.
 * @param compatModeEnabled Whether the Mobile Engagement Platform (MEP) compatibility mode is enabled or not
 * @returns The updated attribute value, null if we should delete the attribute,
 * or undefined if we should ignore the operation.
 */
export function removeFromArray(
  values: string[],
  targetAttribute: ProfileNullableStringArrayAttribute | undefined | null,
  compatModeEnabled: boolean
): ProfileNullableStringArrayAttribute | null | undefined {
  // Case: Array attribute already exists and is a Set
  if (targetAttribute && isSet(targetAttribute)) {
    const updatedAttribute = new Set(targetAttribute);
    values.forEach(updatedAttribute.delete, updatedAttribute);
    if (updatedAttribute.size === 0) {
      // Return null to delete the attribute on MEP since the attribute is empty.
      // But return undefined on the CEP to ignore the operation.
      return compatModeEnabled ? null : undefined;
    }
    return updatedAttribute;
  }
  // Case: Array attribute already exists and is a Partial Update object ($add/$remove)
  else if (targetAttribute && isPartialUpdateArrayObject(targetAttribute)) {
    const updatedAttribute = deepClone(targetAttribute);
    if (updatedAttribute.$remove) {
      values.forEach(updatedAttribute.$remove.add, updatedAttribute.$remove);
    } else {
      updatedAttribute.$remove = new Set(values);
    }
    return updatedAttribute;
  }
  // Case: Array attribute already exists and is null
  else if (targetAttribute === null) {
    return null;
  }
  // Case: Array attribute doesn't exist
  else {
    return compatModeEnabled ? null : { $remove: new Set(values) };
  }
}
