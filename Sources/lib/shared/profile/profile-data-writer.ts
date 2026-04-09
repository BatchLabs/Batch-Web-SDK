import { Consts } from "com.batch.shared/constants/user";
import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { isArray, isSet, isString } from "com.batch.shared/helpers/primitive";
import { isNativeOperation } from "com.batch.shared/helpers/typed-attribute";
import { Log } from "com.batch.shared/logger";
import { addToArray, removeFromArray, validateUpdatedTopicPreferences } from "com.batch.shared/profile/profile-data-helper";
import {
  isProfileNullableStringArrayAttribute,
  ProfileAttributeType,
  ProfileCustomDataAttributes,
  ProfileNativeDataAttribute,
} from "com.batch.shared/profile/profile-data-types";
import { IProfileOperation, ProfileDataOperation } from "com.batch.shared/profile/profile-operations";
import { isMEPAttributeStringArrayNotValid, isMEPAttributeStringNotValid } from "com.batch.shared/profile/user-compat-helper";

/**
 * ProfileDataWriter is responsible for applying operations on custom and native attributes.
 */
export default class ProfileDataWriter {
  /**
   * Whether the Mobile Engagement Platform (MEP) compatibility mode is enabled or not.
   * @private
   */
  private compatModeEnabled: boolean;

  /**
   * Custom attributes to apply operations on.
   * @private
   */
  private customAttributes: ProfileCustomDataAttributes = {};

  /**
   * Native attributes to apply operations on.
   * @private
   */
  private nativeAttributes: ProfileNativeDataAttribute[] = [];

  /**
   * Creates a new ProfileDataWriter instance.
   *
   * @param compatMode Whether the Mobile Engagement Platform (MEP) compatibility mode is enabled or not.
   * @param currentAttributes Custom attributes from IndexedDb (MEP).
   */
  public constructor(compatMode: boolean, currentAttributes?: ProfileCustomDataAttributes) {
    this.compatModeEnabled = compatMode;
    if (currentAttributes) {
      this.customAttributes = deepClone(currentAttributes);
    }
  }

  /**
   * Apply operations on custom attributes.
   *
   * @param operations Operations to apply.
   * @returns The updated custom attributes.
   * @private
   */
  private applyCustomAttributes(operations: IProfileOperation[]): ProfileCustomDataAttributes {
    for (const op of operations) {
      const key = this.normalizeAttributeName(op.key);
      switch (op.operation) {
        case ProfileDataOperation.SetAttribute:
          {
            if (
              this.compatModeEnabled &&
              op.type === ProfileAttributeType.STRING &&
              isString(op.value) &&
              isMEPAttributeStringNotValid(op.value)
            ) {
              Log.warn(
                "User",
                `String attributes can't be null, empty or longer than ${Consts.AttributeStringMaxLengthMEP} characters
                 for the Mobile Engagement Platform (MEP). Ignoring attribute '${op.key}'.`
              );
              continue;
            }
            if (
              this.compatModeEnabled &&
              op.type === ProfileAttributeType.ARRAY &&
              isSet(op.value) &&
              isMEPAttributeStringArrayNotValid(Array.from(op.value))
            ) {
              Log.warn(
                "User",
                `String array attributes must only have values of type String 
                and must respect the string attribute limitations for the Mobile Engagement Platform (MEP).
                 Ignoring attribute '${op.key}'.`
              );
              continue;
            }
            this.customAttributes[key] = {
              value: op.value,
              type: op.type,
            };
          }
          break;
        case ProfileDataOperation.AddToArray:
          {
            const values = op.value.map(val => this.normalizeAttributeName(val));
            const targetAttribute = this.customAttributes[key];
            const targetValue = targetAttribute?.value;
            if (this.compatModeEnabled && isMEPAttributeStringArrayNotValid(values)) {
              Log.warn(
                "User",
                `String array attributes must only have values of type String 
                and must respect the string attribute limitations for the Mobile Engagement Platform (MEP).
                 Ignoring attribute '${op.key}'.`
              );
              continue;
            }
            if (isProfileNullableStringArrayAttribute(targetValue)) {
              this.customAttributes[key] = {
                type: ProfileAttributeType.ARRAY,
                value: addToArray(values, targetValue, this.compatModeEnabled),
              };
            }
          }
          break;
        case ProfileDataOperation.RemoveFromArray:
          {
            const values = op.value.map(val => this.normalizeAttributeName(val));
            const targetAttribute = this.customAttributes[key];
            const targetValue = targetAttribute?.value;

            if (this.compatModeEnabled && isMEPAttributeStringArrayNotValid(values)) {
              Log.warn(
                "User",
                `String array attributes must only have values of type String 
                and must respect the string attribute limitations for the Mobile Engagement Platform (MEP).
                 Ignoring attribute '${op.key}'.`
              );
              continue;
            }
            if (isProfileNullableStringArrayAttribute(targetValue)) {
              const updatedArray = removeFromArray(values, targetValue, this.compatModeEnabled);
              if (updatedArray === undefined) {
                // Array is empty, we just delete the attribute.
                delete this.customAttributes[key];
              } else if (updatedArray === null) {
                // Array has been explicitly removed, we set the type to avoid unsuffixed key.
                this.customAttributes[key] = {
                  type: ProfileAttributeType.UNKNOWN,
                  value: null,
                };
              } else {
                this.customAttributes[key] = {
                  type: ProfileAttributeType.ARRAY,
                  value: updatedArray,
                };
              }
            }
          }
          break;
        case ProfileDataOperation.RemoveAttribute:
          {
            this.customAttributes[key] = {
              value: null,
              type: ProfileAttributeType.UNKNOWN,
            };
          }
          break;
        default:
          break;
      }
    }

    const arrayAttributes = Object.values(this.customAttributes).filter(attr => attr.type === ProfileAttributeType.ARRAY);
    if (arrayAttributes.length > Consts.MaxProfileArrayAttributesCount) {
      throw new Error(
        `Custom data cannot hold more than ${Consts.MaxProfileArrayAttributesCount} array attributes. Rolling back transaction.`
      );
    }

    for (const element of arrayAttributes) {
      if (isSet(element.value) && element.value.size >= Consts.MaxProfileArrayItems) {
        throw new Error(`An ARRAY attribute cannot hold more than ${Consts.MaxProfileArrayItems} items. Rolling back transaction.`);
      }
    }

    if (Object.keys(this.customAttributes).length >= Consts.MaxProfileAttributesCount) {
      throw new Error(`Custom data cannot hold more than ${Consts.MaxProfileAttributesCount} attributes. Rolling back transaction.`);
    }

    return this.customAttributes;
  }

  /**
   * Apply operations on native attributes.
   *
   * @param operations Operations to apply.
   * @returns The updated native attributes.
   * @private
   */
  private applyNativeAttributes(operations: IProfileOperation[]): ProfileNativeDataAttribute[] {
    for (const operation of operations) {
      if (isNativeOperation(operation)) {
        switch (operation.operation) {
          case ProfileDataOperation.AddToTopicPreferences:
            {
              const topicPreferences = this.nativeAttributes.find(attr => attr.key === operation.key);
              if (topicPreferences) {
                if (isProfileNullableStringArrayAttribute(topicPreferences.value)) {
                  const updatedTopics = addToArray(operation.value, topicPreferences.value, this.compatModeEnabled);
                  if (validateUpdatedTopicPreferences(updatedTopics)) {
                    topicPreferences.value = updatedTopics;
                  } else {
                    Log.warn(
                      "Profile",
                      `Topic preferences must not be empty or longer than ${Consts.MaxEventArrayItems}.
                       Ignoring operation: ${ProfileDataOperation.AddToTopicPreferences} for values: ${operation.value}`
                    );
                  }
                }
              } else {
                this.nativeAttributes.push({
                  key: operation.key,
                  value: addToArray(operation.value, undefined, this.compatModeEnabled),
                });
              }
            }
            break;
          case ProfileDataOperation.RemoveFromTopicPreferences:
            {
              const topicPreferences = this.nativeAttributes.find(attr => attr.key === operation.key);
              if (topicPreferences) {
                if (isProfileNullableStringArrayAttribute(topicPreferences.value)) {
                  const updatedTopics = removeFromArray(operation.value, topicPreferences.value, this.compatModeEnabled);
                  if (updatedTopics !== undefined) {
                    if (validateUpdatedTopicPreferences(updatedTopics)) {
                      topicPreferences.value = updatedTopics;
                    } else {
                      Log.warn(
                        "Profile",
                        `Topic preferences must not be empty or longer than ${Consts.MaxEventArrayItems}.
                       Ignoring operation: ${ProfileDataOperation.RemoveFromTopicPreferences} for values: ${operation.value}`
                      );
                    }
                  } else {
                    // Array is empty, we just remove the attribute.
                    this.nativeAttributes.splice(this.nativeAttributes.indexOf(topicPreferences), 1);
                  }
                }
              } else {
                this.nativeAttributes.push({
                  key: operation.key,
                  value: removeFromArray(operation.value, undefined, this.compatModeEnabled),
                });
              }
            }
            break;
          default:
            if (isArray(operation.value)) {
              this.nativeAttributes.push({
                key: operation.key,
                value: new Set(operation.value),
              });
            } else {
              this.nativeAttributes.push({
                key: operation.key,
                value: operation.value,
              });
            }
            break;
        }
      }
    }
    return this.nativeAttributes;
  }

  /**
   * Normalize an attribute name.
   *
   * @param attributeName The attribute name to normalize.
   * @returns The normalized attribute name.
   * @private
   */
  private normalizeAttributeName(attributeName: string): string {
    return attributeName.toLowerCase();
  }

  /**
   * Apply operations on custom attributes.
   *
   * @param operations Operations to apply.
   * @returns The updated custom attributes.
   */
  public async applyCustomOperations(operations: IProfileOperation[]): Promise<ProfileCustomDataAttributes> {
    const operationsAttributes: IProfileOperation[] = operations.filter(operation =>
      [
        ProfileDataOperation.SetAttribute,
        ProfileDataOperation.RemoveAttribute,
        ProfileDataOperation.AddToArray,
        ProfileDataOperation.RemoveFromArray,
      ].includes(operation.operation)
    );
    return this.applyCustomAttributes(operationsAttributes);
  }

  /**
   * Apply operations on native attributes.
   *
   * @param operations Operations to apply.
   * @returns The updated native attributes.
   */
  public async applyNativeOperations(operations: IProfileOperation[]): Promise<ProfileNativeDataAttribute[]> {
    const operationsAttributes: IProfileOperation[] = operations.filter(operation =>
      [
        ProfileDataOperation.SetRegion,
        ProfileDataOperation.SetLanguage,
        ProfileDataOperation.SetEmail,
        ProfileDataOperation.SetEmailMarketingSubscriptionState,
        ProfileDataOperation.SetTopicPreferences,
        ProfileDataOperation.AddToTopicPreferences,
        ProfileDataOperation.RemoveFromTopicPreferences,
      ].includes(operation.operation)
    );
    return this.applyNativeAttributes(operationsAttributes);
  }
}
