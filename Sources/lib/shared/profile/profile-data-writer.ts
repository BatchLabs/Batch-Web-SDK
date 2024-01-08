import { Consts } from "com.batch.shared/constants/user";
import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { isSet } from "com.batch.shared/helpers/primitive";
import { isNativeOperation } from "com.batch.shared/helpers/typed-attribute";
import {
  isPartialUpdateArrayObject,
  ProfileAttributeType,
  ProfileCustomDataAttributes,
  ProfileNativeDataAttribute,
} from "com.batch.shared/profile/profile-data-types";

import { IProfileOperation, ProfileDataOperation } from "./profile-attribute-editor";

export default class ProfileDataWriter {
  private compatModeEnabled: boolean;
  private customAttributes: ProfileCustomDataAttributes = {};
  private nativeAttributes: ProfileNativeDataAttribute[] = [];
  public constructor(compatMode: boolean, currentAttributes?: ProfileCustomDataAttributes) {
    this.compatModeEnabled = compatMode;
    if (currentAttributes) {
      this.customAttributes = deepClone(currentAttributes);
    }
  }

  private applyCustomAttributes(operations: IProfileOperation[]): ProfileCustomDataAttributes {
    for (const op of operations) {
      switch (op.operation) {
        case ProfileDataOperation.SetAttribute:
          {
            this.customAttributes[this.normalizeAttributeName(op.key)] = {
              value: op.value,
              type: op.type,
            };
          }
          break;
        case ProfileDataOperation.AddToArray:
          {
            const key = this.normalizeAttributeName(op.key);
            const values = op.value.map(val => this.normalizeAttributeName(val));
            const targetAttribute = this.customAttributes[key];

            // Case: Array attribute already exist and is a Set
            if (targetAttribute && isSet(targetAttribute.value)) {
              values.forEach(targetAttribute.value.add, targetAttribute.value);
            }
            // Case: Array attribute already exist and is a Partial Update object ($add/$remove)
            else if (targetAttribute && isPartialUpdateArrayObject(targetAttribute.value)) {
              if (targetAttribute.value.$add) {
                values.forEach(targetAttribute.value.$add.add, targetAttribute.value.$add);
              } else {
                targetAttribute.value.$add = new Set(values);
              }
            }
            // Case: Array attribute already exist and is null
            else if (targetAttribute?.value === null) {
              this.customAttributes[key] = {
                value: new Set(values),
                type: ProfileAttributeType.ARRAY,
              };
            }
            // Case: Array attribute doesn't exist
            else {
              this.customAttributes[key] = {
                value: this.compatModeEnabled ? new Set(values) : { $add: new Set(values) },
                type: ProfileAttributeType.ARRAY,
              };
            }
          }
          break;
        case ProfileDataOperation.RemoveFromArray:
          {
            const key = this.normalizeAttributeName(op.key);
            const values = op.value.map(val => this.normalizeAttributeName(val));
            const targetAttribute = this.customAttributes[key];

            // Case: Array attribute already exist and is a Set
            if (targetAttribute && isSet(targetAttribute.value)) {
              values.forEach(targetAttribute.value.delete, targetAttribute.value);
              // Cleanup empty array attribute
              if (targetAttribute.value.size === 0) {
                this.customAttributes[key].value = null;
              }
            }
            // Case: Array attribute already exist and is a Partial Update object ($add/$remove)
            else if (targetAttribute && isPartialUpdateArrayObject(targetAttribute.value)) {
              if (targetAttribute.value.$remove) {
                values.forEach(targetAttribute.value.$remove.add, targetAttribute.value.$remove);
              } else {
                targetAttribute.value.$remove = new Set(values);
              }
            }
            // Case: Array attribute already exist and is null
            else if (targetAttribute?.value === null) {
              // Do nothing, we set the type to avoid un-suffixed key, but it's useless
              this.customAttributes[key].type = ProfileAttributeType.ARRAY;
            }
            // Case: Array attribute doesn't exist
            else if (!this.compatModeEnabled) {
              this.customAttributes[key] = {
                value: { $remove: new Set(values) },
                type: ProfileAttributeType.ARRAY,
              };
            }
          }
          break;
        case ProfileDataOperation.RemoveAttribute:
          {
            const targetAttribute = this.customAttributes[this.normalizeAttributeName(op.key)];
            if (targetAttribute) {
              this.customAttributes[this.normalizeAttributeName(op.key)].value = null;
            } else {
              this.customAttributes[this.normalizeAttributeName(op.key)] = {
                value: null,
                type: ProfileAttributeType.UNKNOWN,
              };
            }
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

  private applyNativeAttributes(operations: IProfileOperation[]): ProfileNativeDataAttribute[] {
    for (const operation of operations) {
      if (isNativeOperation(operation)) {
        this.nativeAttributes.push({
          key: operation.key,
          value: operation.value,
        });
      }
    }
    return this.nativeAttributes;
  }

  private normalizeAttributeName(attributeName: string): string {
    return attributeName.toLowerCase();
  }

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

  public async applyNativeOperations(operations: IProfileOperation[]): Promise<ProfileNativeDataAttribute[]> {
    const operationsAttributes: IProfileOperation[] = operations.filter(operation =>
      [
        ProfileDataOperation.SetRegion,
        ProfileDataOperation.SetLanguage,
        ProfileDataOperation.SetEmail,
        ProfileDataOperation.SetEmailMarketingSubscriptionState,
      ].includes(operation.operation)
    );
    return this.applyNativeAttributes(operationsAttributes);
  }
}
