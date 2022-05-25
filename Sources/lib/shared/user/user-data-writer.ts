import { Consts } from "com.batch.shared/constants/user";
import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { Log } from "com.batch.shared/logger";

import { IOperation, UserAttributeType, UserDataOperation } from "./user-attribute-editor";

const logModuleName = "User attribute";

export type UserDataTagCollections = {
  [key: string]: Set<string>;
};

export type UserDataAttribute = {
  value: string | number | boolean;
  type: UserAttributeType;
};

export type UserDataAttributes = {
  [key: string]: UserDataAttribute;
};

export type UserData = {
  attributes: UserDataAttributes;
  tags: UserDataTagCollections;
};

export class UserDataWriter {
  private attributes: UserDataAttributes = {};
  private tags: { [key: string]: Set<string> } = {};

  public constructor(currentAttributes: UserDataAttributes, currentTags: UserDataTagCollections) {
    this.attributes = deepClone(currentAttributes);
    this.tags = deepClone(currentTags);
  }

  private checkLimitsTags(tags: { [key: string]: Set<string> }): void {
    if (Object.keys(tags).length >= Consts.MaxUserTagCollectionsCount) {
      throw new Error(`Custom data cannot hold more than ${Consts.MaxUserTagCollectionsCount} tag collections. Rolling back transaction.`);
    }

    for (const element in tags) {
      if (tags[element].size >= Consts.MaxUserTagPerCollectionCount) {
        throw new Error(`A tag collection cannot hold more than ${Consts.MaxUserTagPerCollectionCount} tags. Rolling back transaction.`);
      }
    }
  }

  private applyTags(operationsTags: IOperation[]): UserDataTagCollections {
    for (const tagOperation of operationsTags) {
      switch (tagOperation.operation) {
        case UserDataOperation.AddTag:
          {
            const tagCollection = this.normalizeTagOrCollection(tagOperation.collection);
            const tag = this.normalizeTagOrCollection(tagOperation.tag);
            const targetSet = this.tags[tagCollection] ?? new Set();
            targetSet.add(tag);
            this.tags[tagCollection] = targetSet;
          }

          break;
        case UserDataOperation.RemoveTag:
          {
            const tagCollection = this.normalizeTagOrCollection(tagOperation.collection);
            const targetSet = this.tags[tagCollection];
            targetSet?.delete(this.normalizeTagOrCollection(tagOperation.tag));

            // Cleanup empty collection
            if (targetSet.size === 0) {
              delete this.tags[tagCollection];
            }
          }
          break;
        case UserDataOperation.ClearTagCollection:
          delete this.tags[this.normalizeTagOrCollection(tagOperation.collection)];
          break;
        case UserDataOperation.ClearTags:
          this.tags = {};
          break;
        default:
          Log.warn(logModuleName, `Internal error. The operation: ${tagOperation.operation} does not exist. Ignoring tag.`);
          break;
      }
    }

    this.checkLimitsTags(this.tags);

    return this.tags;
  }

  private applyAttributes(operationsAttributes: IOperation[]): UserDataAttributes {
    for (const operationAttributes of operationsAttributes) {
      switch (operationAttributes.operation) {
        case UserDataOperation.SetAttribute:
          {
            this.attributes[this.normalizeAttributeName(operationAttributes.key)] = {
              value: operationAttributes.value,
              type: operationAttributes.type,
            };
          }
          break;
        case UserDataOperation.ClearAttributes:
          this.attributes = {};
          break;
        case UserDataOperation.RemoveAttribute:
          delete this.attributes[this.normalizeAttributeName(operationAttributes.key)];
          break;
        default:
          break;
      }
    }

    if (Object.keys(this.attributes).length >= Consts.MaxUserAttributesCount) {
      throw new Error(`Custom data cannot hold more than ${Consts.MaxUserAttributesCount} attributes. Rolling back transaction.`);
    }

    return this.attributes;
  }

  private normalizeTagOrCollection(tagOrCollection: string): string {
    return tagOrCollection.toLowerCase();
  }

  private normalizeAttributeName(attributeName: string): string {
    return attributeName.toLowerCase();
  }

  public async applyOperations(operations: IOperation[]): Promise<UserData> {
    const operationsTags: IOperation[] = operations.filter(operation =>
      [UserDataOperation.AddTag, UserDataOperation.ClearTagCollection, UserDataOperation.ClearTags, UserDataOperation.RemoveTag].includes(
        operation.operation
      )
    );
    const operationsAttributes: IOperation[] = operations.filter(operation =>
      [UserDataOperation.SetAttribute, UserDataOperation.ClearAttributes, UserDataOperation.RemoveAttribute].includes(operation.operation)
    );

    const tags = this.applyTags(operationsTags);
    const attributes = this.applyAttributes(operationsAttributes);

    return {
      tags,
      attributes,
    };
  }
}
