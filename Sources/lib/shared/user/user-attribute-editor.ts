import { Consts } from "com.batch.shared/constants/user";
import { isBoolean, isDate, isFloat, isNumber, isString, isURL } from "com.batch.shared/helpers/primitive";
import { isTypedAttributeValue } from "com.batch.shared/helpers/typed-attribute";
import { Log } from "com.batch.shared/logger";
import { BatchSDK } from "public/types/public-api";

const logModuleName = "User Attribute Editor";

export enum UserAttributeType {
  STRING = "s",
  BOOLEAN = "b",
  INTEGER = "i",
  FLOAT = "f",
  DATE = "t",
  URL = "u",
}

export enum UserDataOperation {
  SetAttribute = "SET_ATTRIBUTE",
  RemoveAttribute = "REMOVE_ATTRIBUTE",
  ClearAttributes = "CLEAR_ATTRIBUTES",
  AddTag = "ADD_TAG",
  RemoveTag = "REMOVE_TAG",
  ClearTags = "CLEAR_TAGS",
  ClearTagCollection = "CLEAR_TAG_COLLECTION",
}

type OperationSetAttribute = {
  operation: UserDataOperation.SetAttribute;
  key: string;
  value: string | number | boolean;
  type: UserAttributeType;
};

type OperationRemoveAttribute = {
  operation: UserDataOperation.RemoveAttribute;
  key: string;
};

type TagOperation = {
  operation: UserDataOperation.RemoveTag | UserDataOperation.AddTag;
  tag: string;
  collection: string;
};

type ClearTagCollectionOperation = {
  operation: UserDataOperation.ClearTagCollection;
  collection: string;
};

type ClearOperation = {
  operation: UserDataOperation.ClearTags | UserDataOperation.ClearAttributes;
};

export type IOperation = ClearOperation | ClearTagCollectionOperation | TagOperation | OperationRemoveAttribute | OperationSetAttribute;

export class UserAttributeEditor implements BatchSDK.IUserDataEditor {
  private _operationQueue: IOperation[] = [];
  private usable: boolean = true;

  public constructor() {
    if (!this.usable) {
      Log.warn(logModuleName, "The editor is temporarily unusable while processing all operations.");
    }
    this._operationQueue = [];
  }

  public _getOperations(): IOperation[] {
    return this._operationQueue;
  }

  public _markAsUnusable(): void {
    this.usable = false;
  }

  /**
   * Add an operation to the queue.
   * @private
   * @param operation IOperation
   */
  private _enqueueOperation(operation: IOperation): void {
    this._operationQueue.push(operation);
  }

  public addTag(collection: string, tag: string): UserAttributeEditor {
    if (!isString(collection)) {
      Log.warn(logModuleName, "Collection argument must be a string");
      return this;
    }

    if (!Consts.AttributeKeyRegexp.test(collection || "")) {
      Log.warn(
        logModuleName,
        `Invalid collection. Please make sure that the collection is made of letters, 
        underscores and numbers only (a-zA-Z0-9_). It also can't be longer than 30 characters. Ignoring collection 
          ${collection}.`
      );
      return this;
    }

    if (typeof tag === "undefined") {
      Log.warn(logModuleName, "A tag is required.");
      return this;
    }

    if (isString(tag)) {
      if (tag.length === 0 || tag.length > Consts.EventDataStringMaxLength) {
        Log.warn(logModuleName, `Tags can't be empty or longer than ${Consts.EventDataStringMaxLength} characters. Ignoring tag ${tag}.`);
        return this;
      }
    } else {
      Log.warn(logModuleName, `Tag argument must be a string. Ignoring tag ${tag}.`);
      return this;
    }

    this._enqueueOperation({
      operation: UserDataOperation.AddTag,
      collection: collection.toLowerCase(),
      tag,
    });

    return this;
  }

  public removeTag(collection: string, tag: string): UserAttributeEditor {
    if (!isString(collection)) {
      Log.warn(logModuleName, "Collection argument must be a string");
      return this;
    }

    if (!Consts.AttributeKeyRegexp.test(collection || "")) {
      Log.warn(
        logModuleName,
        `Invalid collection. Please make sure that the collection is made of letters, 
        underscores and numbers only (a-zA-Z0-9_). It also can't be longer than 30 characters. Ignoring collection 
          ${collection}.`
      );
      return this;
    }

    if (isString(tag)) {
      if (tag.length === 0 || tag.length > Consts.EventDataStringMaxLength) {
        Log.warn(logModuleName, `Tags can't be empty or longer than ${Consts.EventDataStringMaxLength} characters. Ignoring tag ${tag}.`);
        return this;
      }
    } else {
      Log.warn(logModuleName, `Tag argument must be a string. Ignoring tag ${tag}.`);
      return this;
    }

    this._enqueueOperation({
      operation: UserDataOperation.RemoveTag,
      collection,
      tag,
    });

    return this;
  }

  public clearTagCollection(collection: string): UserAttributeEditor {
    if (!isString(collection)) {
      Log.warn(logModuleName, "Collection argument must be a string");
      return this;
    }

    if (!Consts.AttributeKeyRegexp.test(collection || "")) {
      Log.warn(
        logModuleName,
        `Invalid collection. Please make sure that the collection is made of letters, 
        underscores and numbers only (a-zA-Z0-9_). It also can't be longer than 30 characters. Ignoring collection 
          ${collection}.`
      );
      return this;
    }

    this._enqueueOperation({ operation: UserDataOperation.ClearTagCollection, collection });

    return this;
  }

  public clearTags(): UserAttributeEditor {
    this._enqueueOperation({ operation: UserDataOperation.ClearTags });

    return this;
  }

  public setAttribute(key: string, value: BatchSDK.UserAttributeValue | string | boolean | number | URL | Date): UserAttributeEditor {
    if (!isString(key)) {
      Log.warn(logModuleName, "key must be a string.");
      return this;
    }

    if (!Consts.AttributeKeyRegexp.test(key || "")) {
      Log.warn(
        logModuleName,
        `Invalid key. Please make sure that the key is made of letters, 
      underscores and numbers only (a-zA-Z0-9_). It also can't be longer than 30 characters. Ignoring attribute 
        ${key}.`
      );
      return this;
    }

    const operationData = { value, key, type: "" };

    if (isTypedAttributeValue(value)) {
      if (typeof value.value === "undefined" || value.value === null) {
        Log.warn(logModuleName, `value cannot be undefined or null. Ignoring attribute ${key}.`);
        return this;
      }
      const userAttributeValueConverted = UserAttributeEditor.convertValueUserAttribute(value, key);
      if (userAttributeValueConverted === undefined) {
        return this;
      }
      operationData.value = userAttributeValueConverted;
      operationData.type = value.type;
    } else {
      const userAttribute = UserAttributeEditor.autoDetectNoTypedUserAttribute(key, value);
      if (userAttribute === undefined) {
        return this;
      }
      operationData.type = userAttribute.type;
      operationData.value = userAttribute.value;
    }

    this._enqueueOperation({
      operation: UserDataOperation.SetAttribute,
      key: operationData.key.toLowerCase(),
      type: operationData.type as UserAttributeType,
      value: operationData.value,
    });

    return this;
  }

  public removeAttribute(key: string): UserAttributeEditor {
    if (!Consts.AttributeKeyRegexp.test(key || "")) {
      Log.warn(
        logModuleName,
        `Invalid key. Please make sure that the key is made of letters, underscores and numbers only (a-zA-Z0-9_). 
         It also can't be longer than 30 characters. Ignoring attribute 
          ${key}.`
      );
      return this;
    }

    this._enqueueOperation({ operation: UserDataOperation.RemoveAttribute, key });

    return this;
  }

  public clearAttributes(): UserAttributeEditor {
    this._enqueueOperation({ operation: UserDataOperation.ClearAttributes });

    return this;
  }

  private static autoDetectNoTypedUserAttribute(
    key: string,
    value: string | number | boolean | URL | Date
  ):
    | {
        value: string | number | boolean;
        type: string;
      }
    | undefined {
    const userAttribute: {
      value: string | number | boolean;
      type: string;
    } = { value: "", type: "" };

    if (typeof value === "undefined" || value === null) {
      Log.warn(logModuleName, `value cannot be undefined or null. Ignoring attribute ${key}.`);
      return;
    }
    if (isURL(value)) {
      const URLToString = URL.prototype.toString.call(value);
      if (URLToString.length === 0 || URLToString.length > Consts.AttributeURLMaxLength) {
        Log.warn(
          logModuleName,
          `URL attribute can't be empty or longer than ${Consts.AttributeURLMaxLength} characters. Ignoring attribute ${key}.`
        );
        return;
      }
      userAttribute.value = URL.prototype.toString.call(value);
      userAttribute.type = UserAttributeType.URL;
      return userAttribute;
    }
    if (isString(value)) {
      if (value.length === 0 || value.length > Consts.AttributeStringMaxLength) {
        Log.warn(
          logModuleName,
          `String attributes can't be empty or longer than ${Consts.AttributeStringMaxLength}
          characters. Ignoring attribute ${key}.`
        );
        return;
      }
      userAttribute.value = value;
      userAttribute.type = UserAttributeType.STRING;
      return userAttribute;
    }
    if (isDate(value)) {
      userAttribute.value = value.getTime();
      userAttribute.type = UserAttributeType.DATE;
      return userAttribute;
    }
    if (isFloat(value)) {
      userAttribute.value = value;
      userAttribute.type = UserAttributeType.FLOAT;
      return userAttribute;
    }
    if (isNumber(value)) {
      userAttribute.value = value;
      userAttribute.type = UserAttributeType.INTEGER;
      return userAttribute;
    }
    if (isBoolean(value)) {
      userAttribute.value = value;
      userAttribute.type = UserAttributeType.BOOLEAN;
      return userAttribute;
    }

    Log.warn(`No type corresponding to this value ${value}. Ignoring attribute ${key}.`);
  }

  private static convertValueUserAttribute(userAttribute: BatchSDK.UserAttributeValue, key: string): string | number | boolean | undefined {
    switch (userAttribute.type) {
      case UserAttributeType.URL: {
        if (isURL(userAttribute.value)) {
          const URLToString = URL.prototype.toString.call(userAttribute.value);
          if (URLToString.length === 0 || URLToString.length > Consts.AttributeURLMaxLength) {
            Log.warn(
              logModuleName,
              `URL attribute can't be empty or longer than ${Consts.AttributeURLMaxLength} characters. Ignoring attribute ${key}.`
            );
            return;
          }
          return URLToString;
        }
        if (isString(userAttribute.value)) {
          try {
            const convertedUrlValue = new URL(userAttribute.value);
            const URLToString = URL.prototype.toString.call(convertedUrlValue);

            if (URLToString.length === 0 || URLToString.length > Consts.AttributeURLMaxLength) {
              Log.warn(
                logModuleName,
                `URL attribute can't be empty or longer than ${Consts.AttributeURLMaxLength} characters. Ignoring attribute ${key}.`
              );
              return;
            }

            return URLToString;
          } catch (e) {
            Log.warn(
              logModuleName,
              `Invalid attribute value for the URL type, must respect scheme://[authority][path][?query][#fragment] format. Ignoring attribute ${key}.`
            );
            return;
          }
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the URL type. Must be a string, or URL. 
            Ignoring attribute with this value: ${userAttribute.value}.`
        );
        return;
      }
      case UserAttributeType.STRING: {
        if (userAttribute.value.length === 0 || userAttribute.value.length > Consts.AttributeStringMaxLength) {
          Log.warn(
            logModuleName,
            `String attributes can't be empty or longer than ${Consts.AttributeStringMaxLength}
            characters. Ignoring attribute ${key}.`
          );
          return;
        }
        if (isString(userAttribute.value) || isNumber(userAttribute.value)) {
          return userAttribute.value.toString();
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the STRING type. Must be a string, or number. 
          Ignoring attribute with this value: ${userAttribute.value}.`
        );
        return;
      }
      case UserAttributeType.INTEGER: {
        if (isString(userAttribute.value) || isNumber(userAttribute.value)) {
          return Math.ceil(Number(userAttribute.value));
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the INTEGER type. Must be a string, or number. 
          Ignoring attribute with this value: ${userAttribute.value}.`
        );
        return;
      }
      case UserAttributeType.FLOAT: {
        if (isString(userAttribute.value) || isNumber(userAttribute.value)) {
          return Number(userAttribute.value);
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the FLOAT type. Must be a string, or number. 
          Ignoring attribute with this value: ${userAttribute.value}.`
        );
        return;
      }
      case UserAttributeType.BOOLEAN: {
        if (isBoolean(userAttribute.value)) {
          return Boolean(userAttribute.value);
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the BOOLEAN type. Must be a boolean or number. 
          Ignoring attribute with this value: ${userAttribute.value}.`
        );
        return;
      }
      case UserAttributeType.DATE: {
        if (isDate(userAttribute.value)) {
          return userAttribute.value.getTime();
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the DATE type. Must be a DATE. 
          Ignoring attribute with this value: ${userAttribute.value}.`
        );
        return;
      }
      default:
        Log.warn(`The type: ${userAttribute.type} not exist. Ignoring attribute.`);
        return;
    }
  }
}
