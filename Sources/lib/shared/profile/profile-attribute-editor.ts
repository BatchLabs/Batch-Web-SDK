import { Consts } from "com.batch.shared/constants/user";
import { isArray, isBoolean, isDate, isFloat, isNumber, isString, isURL } from "com.batch.shared/helpers/primitive";
import { isProfileTypedAttributeValue } from "com.batch.shared/helpers/typed-attribute";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType, ProfileNativeAttributeType } from "com.batch.shared/profile/profile-data-types";

import { BatchSDK } from "../../../public/types/public-api";

const logModuleName = "Profile Attribute Editor";

const allowedSubscriptions = ["subscribed", "unsubscribed"];

export enum ProfileDataOperation {
  SetAttribute = "SET_ATTRIBUTE",
  RemoveAttribute = "REMOVE_ATTRIBUTE",
  AddToArray = "ADD_TO_ARRAY",
  RemoveFromArray = "REMOVE_FROM_ARRAY",
  SetLanguage = "SET_LANGUAGE",
  SetRegion = "SET_REGION",
  SetEmail = "SET_EMAIL",
  SetEmailMarketingSubscriptionState = "SET_EMAIL_MARKETING_SUBSCRIPTION_STATE",
}

type SetAttributeOperation = {
  operation: ProfileDataOperation.SetAttribute;
  key: string;
  value: string | number | boolean | Set<string>;
  type: ProfileAttributeType;
};

type RemoveAttributeOperation = {
  operation: ProfileDataOperation.RemoveAttribute;
  key: string;
};

type PutInAttributeOperation = {
  operation: ProfileDataOperation.AddToArray;
  key: string;
  value: Array<string>;
};

type RemoveInAttributeOperation = {
  operation: ProfileDataOperation.RemoveFromArray;
  key: string;
  value: Array<string>;
};

type SetLanguageOperation = {
  operation: ProfileDataOperation.SetLanguage;
  key: ProfileNativeAttributeType.LANGUAGE;
  value: string | null;
};
type SetRegionOperation = {
  operation: ProfileDataOperation.SetRegion;
  key: ProfileNativeAttributeType.REGION;
  value: string | null;
};

type SetEmailOperation = {
  operation: ProfileDataOperation.SetEmail;
  key: ProfileNativeAttributeType.EMAIL;
  value: string | null;
};

type SetEmailMarketingSubscriptionStateOperation = {
  operation: ProfileDataOperation.SetEmailMarketingSubscriptionState;
  key: ProfileNativeAttributeType.EMAIL_MARKETING;
  value: string;
};

export type IProfileNativeOperations =
  | SetLanguageOperation
  | SetRegionOperation
  | SetEmailOperation
  | SetEmailMarketingSubscriptionStateOperation;

export type IProfileOperation =
  | RemoveAttributeOperation
  | SetAttributeOperation
  | PutInAttributeOperation
  | RemoveInAttributeOperation
  | IProfileNativeOperations;

/**
 * Helper method to validate an attribute's key
 *
 * @return true if key is valid, else log warning message and return false
 * @param key The attribute's key
 * @private
 */
function isValidAttributeKey(key: string): boolean {
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

function isValidStringValue(value: string, key?: string): boolean {
  if (value.length === 0 || value.length > Consts.AttributeStringMaxLength) {
    Log.warn(
      logModuleName,
      `String attributes can't be empty or longer than ${Consts.AttributeStringMaxLength}
            characters. Ignoring attribute ${key}.`
    );
    return false;
  }
  return true;
}

/**
 * Batch profile attribute editor
 */
export class ProfileAttributeEditor implements BatchSDK.IProfileDataEditor {
  /**
   * Editor operation's queue.
   * @private
   */
  private _operationQueue: IProfileOperation[] = [];

  /**
   * Flag indicating whether this editor is usable.
   * @private
   */
  private _usable: boolean = true;

  /**
   * Flag indicating whether the profile is logged or anonymous.
   * @private
   */
  private _isLogged: boolean;

  /**
   * Constructor
   *
   * @param isLogged Whether the profile is logged
   */
  public constructor(isLogged: boolean) {
    if (!this._usable) {
      Log.warn(logModuleName, "The editor is temporarily unusable while processing all operations.");
    }
    this._isLogged = isLogged;
    this._operationQueue = [];
  }

  /**
   * Get the operation queue.
   */
  public getOperations(): IProfileOperation[] {
    return this._operationQueue;
  }

  /**
   * Set this editor instance as unusable.
   */
  public markAsUnusable(): void {
    this._usable = false;
  }

  /**
   * Add an operation to the queue.
   *
   * @private
   * @param operation IOperation
   */
  private _enqueueOperation(operation: IProfileOperation): void {
    this._operationQueue.push(operation);
  }

  /**
   * Set the language of this profile
   * Overrides the detected language.
   *
   * @param language lowercase, ISO 639 formatted string. null to reset.
   * @return This object instance, for method chaining
   */
  public setLanguage(language: string | null): ProfileAttributeEditor {
    if (isString(language) && language.trim().length < 2) {
      Log.warn(logModuleName, "Language must be at least 2 chars, lowercase, ISO 639 formatted string.");
      return this;
    }
    this._enqueueOperation({
      operation: ProfileDataOperation.SetLanguage,
      key: ProfileNativeAttributeType.LANGUAGE,
      value: language,
    });
    return this;
  }

  /**
   * Set the region of this profile.
   *
   * @param region uppercase, ISO 3166 formatted string. null to reset.
   * @return This object instance, for method chaining.
   */
  public setRegion(region: string | null): ProfileAttributeEditor {
    if (isString(region) && region.trim().length < 2) {
      Log.warn(logModuleName, "Region must be at least 2 chars, uppercase, ISO 3166 formatted.");
      return this;
    }
    this._enqueueOperation({
      operation: ProfileDataOperation.SetRegion,
      key: ProfileNativeAttributeType.REGION,
      value: region,
    });
    return this;
  }

  /**
   * Set the profile email.
   *
   * Note: This method requires to have a profile logged.
   * @param email A valid email address
   * @return This object instance, for method chaining.
   */
  public setEmailAddress(email: string | null): ProfileAttributeEditor {
    if (!this._isLogged) {
      Log.warn(logModuleName, "You cannot set/reset an email to an anonymous profile. Please use the `identify` method beforehand.");
      return this;
    }

    if (email == null || typeof email === "undefined") {
      this._enqueueOperation({
        operation: ProfileDataOperation.SetEmail,
        key: ProfileNativeAttributeType.EMAIL,
        value: null,
      });
      return this;
    }

    if (!Consts.EmailAddressRegexp.test(email || "")) {
      Log.warn(logModuleName, "Invalid email address. Please make sure to respect the following format: `*@*.* `");
      return this;
    }

    if (isString(email) && email.length > Consts.EmailAddressMaxLength) {
      Log.warn(logModuleName, `Email cannot be longer than ${Consts.EmailAddressMaxLength} characters.`);
      return this;
    }

    this._enqueueOperation({
      operation: ProfileDataOperation.SetEmail,
      key: ProfileNativeAttributeType.EMAIL,
      value: email,
    });
    return this;
  }

  /**
   * Set the profile email marketing subscription.
   *
   * @param state State of the subscription
   * @return This object instance, for method chaining.
   */
  public setEmailMarketingSubscription(state: "subscribed" | "unsubscribed"): ProfileAttributeEditor {
    if (!allowedSubscriptions.includes(state)) {
      Log.warn(logModuleName, `Invalid email subscription state, ignoring.`);
      return this;
    }
    this._enqueueOperation({
      operation: ProfileDataOperation.SetEmailMarketingSubscriptionState,
      key: ProfileNativeAttributeType.EMAIL_MARKETING,
      value: state,
    });
    return this;
  }

  /**
   * Set a custom profile attribute.
   *
   * @param key Attribute key, can't be null or undefined. It should be made of letters, underscores and numbers only
   * (a-zA-Z0-9_). It also can't be longer than 30 characters.
   * @param value Attribute value.
   * @return This object instance, for method chaining
   */
  public setAttribute(key: string, value: BatchSDK.ProfileAttributeValue): ProfileAttributeEditor {
    if (!isValidAttributeKey(key)) {
      return this;
    }

    // Accept null or undefined value to remove attribute
    if (value === null || value === undefined) {
      this._enqueueOperation({ operation: ProfileDataOperation.RemoveAttribute, key });
      return this;
    }

    let operationDataValue, operationDataType: unknown;

    if (isProfileTypedAttributeValue(value)) {
      if (typeof value.value === "undefined" || value.value === null) {
        Log.warn(logModuleName, `value cannot be undefined or null. Ignoring attribute ${key}.`);
        return this;
      }
      const userAttributeValueConverted = this.convertValueProfileAttribute(key, value);
      if (userAttributeValueConverted === undefined) {
        return this;
      }
      operationDataValue = userAttributeValueConverted;
      operationDataType = value.type;
    } else {
      const userAttribute = this.autoDetectNoTypedProfileAttribute(key, value);
      if (userAttribute === undefined) {
        return this;
      }
      operationDataValue = userAttribute.value;
      operationDataType = userAttribute.type;
    }

    this._enqueueOperation({
      operation: ProfileDataOperation.SetAttribute,
      key: key.toLowerCase(),
      type: operationDataType as ProfileAttributeType,
      value: operationDataValue,
    });
    return this;
  }

  /**
   * Removes a custom attribute.
   * Does nothing if it was not set.
   *
   * @param key Attribute key
   * @return This object instance, for method chaining
   */
  public removeAttribute(key: string): ProfileAttributeEditor {
    if (!isValidAttributeKey(key)) {
      return this;
    }
    this._enqueueOperation({ operation: ProfileDataOperation.RemoveAttribute, key });
    return this;
  }

  /**
   * Put a value in an attribute of type Array.
   *
   * @param key Attribute key, can't be null or undefined. It should be made of letters, underscores and numbers only
   * (a-zA-Z0-9_). It also can't be longer than 30 characters.
   * @param value Attribute values to add.
   * @return This object instance, for method chaining
   */
  public addToArray(key: string, value: Array<string>): ProfileAttributeEditor {
    if (!isValidAttributeKey(key)) {
      return this;
    }
    if (!isArray(value)) {
      Log.debug(logModuleName, "Value for `addToArray` must be an array of string. Aborting");
      return this;
    }
    if (value.length > 0 && !value.every(it => isValidStringValue(it))) {
      return this;
    }

    this._enqueueOperation({
      operation: ProfileDataOperation.AddToArray,
      key: key.toLowerCase(),
      value: value,
    });
    return this;
  }

  /**
   * Removes values from a custom attribute of type Array.
   * Does nothing if it was not set.
   *
   * @param key Attribute key, can't be null or undefined. It should be made of letters, underscores and numbers only
   * (a-zA-Z0-9_). It also can't be longer than 30 characters.
   * @param value Attribute values to remove.
   * @return This object instance, for method chaining
   */
  public removeFromArray(key: string, value: Array<string>): ProfileAttributeEditor {
    if (!isValidAttributeKey(key)) {
      return this;
    }
    if (!isArray(value)) {
      Log.debug(logModuleName, "Value for `removeFromArray` must be an array of string. Aborting");
      return this;
    }
    this._enqueueOperation({
      operation: ProfileDataOperation.RemoveFromArray,
      key: key.toLowerCase(),
      value: value,
    });
    return this;
  }

  private autoDetectNoTypedProfileAttribute(
    key: string,
    value: string | number | boolean | URL | Date | Array<string>
  ):
    | {
        value: string | number | boolean | Set<string>;
        type: string;
      }
    | undefined {
    const userAttribute: {
      value: string | number | boolean | Set<string>;
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
      userAttribute.type = ProfileAttributeType.URL;
      return userAttribute;
    }
    if (isString(value)) {
      if (!isValidStringValue(value, key)) {
        return;
      }
      userAttribute.value = value;
      userAttribute.type = ProfileAttributeType.STRING;
      return userAttribute;
    }
    if (isDate(value)) {
      userAttribute.value = value.getTime();
      userAttribute.type = ProfileAttributeType.DATE;
      return userAttribute;
    }
    if (isFloat(value)) {
      userAttribute.value = value;
      userAttribute.type = ProfileAttributeType.FLOAT;
      return userAttribute;
    }
    if (isNumber(value)) {
      userAttribute.value = value;
      userAttribute.type = ProfileAttributeType.INTEGER;
      return userAttribute;
    }
    if (isBoolean(value)) {
      userAttribute.value = value;
      userAttribute.type = ProfileAttributeType.BOOLEAN;
      return userAttribute;
    }
    if (isArray(value)) {
      userAttribute.value = new Set(value.map(val => val.toLocaleLowerCase()));
      userAttribute.type = ProfileAttributeType.ARRAY;
      return userAttribute;
    }
    Log.warn(`No type corresponding to this value ${value}. Ignoring attribute ${key}.`);
  }

  private convertValueProfileAttribute(
    key: string,
    userAttribute: BatchSDK.ProfileTypedAttributeValue
  ): string | number | boolean | Set<string> | undefined {
    switch (userAttribute.type) {
      case ProfileAttributeType.URL: {
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
      case ProfileAttributeType.STRING: {
        if (!isValidStringValue(userAttribute.value, key)) {
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
      case ProfileAttributeType.INTEGER: {
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
      case ProfileAttributeType.FLOAT: {
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
      case ProfileAttributeType.BOOLEAN: {
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
      case ProfileAttributeType.DATE: {
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
      case ProfileAttributeType.ARRAY: {
        if (isArray(userAttribute.value)) {
          return new Set(userAttribute.value.map((val: string) => val.toLocaleLowerCase()));
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the ARRAY type. Must be an ARRAY.
          Ignoring attribute with this value: ${userAttribute.value}.`
        );
        return;
      }
      default:
        Log.warn("This type does not exist. Ignoring attribute.");
        return;
    }
  }
}
