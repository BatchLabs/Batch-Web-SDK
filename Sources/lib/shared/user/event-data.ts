import { Consts } from "com.batch.shared/constants/user";
import { isBoolean, isDate, isFloat, isNumber, isString, isURL } from "com.batch.shared/helpers/primitive";
import { isTypedAttributeValue } from "com.batch.shared/helpers/typed-attribute";
import { Log } from "com.batch.shared/logger";
import type { BatchSDK } from "public/types/public-api";

export interface ITypedEventAttribute {
  value: string | boolean | number | URL | Date;
}

export enum TypedEventAttributeType {
  STRING = "s",
  BOOLEAN = "b",
  INTEGER = "i",
  FLOAT = "f",
  DATE = "t",
  URL = "u",
}

export interface IEventDataInternalRepresentation {
  tags: string[];
  label?: string;
  attributes: { [key: string]: ITypedEventAttribute };
}

const logModuleName = "Event Data";

export class EventData {
  public tags: string[];
  public label?: string;
  public attributes: { [key: string]: ITypedEventAttribute };

  public constructor(params?: BatchSDK.EventDataParams) {
    const label = EventData.getLabel(params?.label);
    if (label) {
      this.label = label;
    }

    this.tags = EventData.getTags(params);
    this.attributes = EventData.getAttributes(params);
  }

  private static getTags(params?: BatchSDK.EventDataParams): string[] {
    const tags: Set<string> = new Set();

    if (params && params.tags) {
      params.tags.forEach((tag, index) => {
        if (index >= Consts.MaxEventTagsCount) {
          Log.warn(logModuleName, `Tags can't be longer than ${Consts.MaxEventTagsCount} elements. Ignoring tag ${tag}`);
          return;
        }
        if (typeof tag === "undefined") {
          Log.warn(logModuleName, "A tag is required.");
          return;
        }

        if (isString(tag)) {
          if (tag.length === 0 || tag.length > Consts.EventDataStringMaxLength) {
            Log.warn(
              logModuleName,
              `Tags can't be empty or longer than ${Consts.EventDataStringMaxLength} characters. Ignoring tag ${tag}.`
            );
            return;
          }
        } else {
          Log.warn(logModuleName, `Tag argument must be a string. Ignoring tag ${tag}.`);
          return;
        }
        tags.add(tag.toLowerCase());
      });
    }

    return Array.from(tags);
  }

  private static autoDetectNoTypedAttribute(
    key: string,
    value: string | number | boolean | URL | Date
  ): { [key: string]: string | boolean | number | URL | Date } | undefined {
    const attribute: { [key: string]: string | boolean | number | URL | Date } = {};
    if (isURL(value)) {
      const URLToString = URL.prototype.toString.call(value);
      if (URLToString.length === 0 || URLToString.length > Consts.AttributeURLMaxLength) {
        Log.warn(
          logModuleName,
          `URL attribute can't be empty or longer than ${Consts.AttributeURLMaxLength} characters. Ignoring attribute ${key}.`
        );
        return;
      }
      attribute[`${key.toLowerCase()}.${TypedEventAttributeType.URL}`] = URL.prototype.toString.call(value);
      return attribute;
    }
    if (isString(value)) {
      if (value.length === 0 || value.length > Consts.AttributeStringMaxLength) {
        Log.warn(
          logModuleName,
          `String attribute can't be empty or longer than ${Consts.AttributeStringMaxLength} characters. Ignoring attribute ${key}.`
        );
        return;
      }
      attribute[`${key.toLowerCase()}.${TypedEventAttributeType.STRING}`] = value;
      return attribute;
    }
    if (isDate(value)) {
      attribute[`${key.toLowerCase()}.${TypedEventAttributeType.DATE}`] = value.getTime();
      return attribute;
    }
    if (isFloat(value)) {
      attribute[`${key.toLowerCase()}.${TypedEventAttributeType.FLOAT}`] = value;
      return attribute;
    }
    if (isNumber(value)) {
      attribute[`${key.toLowerCase()}.${TypedEventAttributeType.INTEGER}`] = value;
      return attribute;
    }
    if (isBoolean(value)) {
      attribute[`${key.toLowerCase()}.${TypedEventAttributeType.BOOLEAN}`] = value;
      return attribute;
    }

    Log.warn(`No type corresponding to this value ${value}. Ignoring attribute ${key}`);
  }

  private static convertValueAttribute(key: string, v: BatchSDK.EventAttributeValue): string | boolean | number | URL | Date | undefined {
    const { value, type } = v;
    switch (type) {
      case TypedEventAttributeType.URL: {
        if (isURL(value)) {
          const URLToString = URL.prototype.toString.call(value);
          if (URLToString.length === 0 || URLToString.length > Consts.AttributeURLMaxLength) {
            Log.warn(
              logModuleName,
              `URL attribute can't be empty or longer than ${Consts.AttributeURLMaxLength} characters. Ignoring attribute ${key}.`
            );
            return;
          }
          return URLToString;
        }

        if (isString(value)) {
          try {
            const convertedUrlValue = new URL(value);
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
          `Invalid attribute value for the URL type. Must be a string, or URL. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      case TypedEventAttributeType.STRING: {
        if (isString(value)) {
          if (value.length === 0 || value.length > Consts.AttributeStringMaxLength) {
            Log.warn(
              logModuleName,
              `String attribute value can't be empty or longer than ${Consts.AttributeStringMaxLength} characters. 
              Ignoring attribute ${key}.`
            );
            return;
          }
          return value;
        }
        if (isNumber(value)) {
          return value.toString();
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the STRING type. Must be a string, or number. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      case TypedEventAttributeType.INTEGER: {
        if (isString(value) || isNumber(value)) {
          return Math.ceil(Number(value));
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the INTEGER type. Must be a string, or number. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      case TypedEventAttributeType.FLOAT: {
        if (isString(value) || isNumber(value)) {
          return Number(value);
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the FLOAT type. Must be a string, or number. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      case TypedEventAttributeType.BOOLEAN: {
        if (isNumber(value) || isBoolean(value)) {
          return Boolean(value);
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the BOOLEAN type. Must be a boolean or number. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      case TypedEventAttributeType.DATE: {
        if (isDate(value)) {
          return value.getTime();
        }
        Log.warn(logModuleName, `Invalid attribute value for the DATE type. Must be a DATE. Ignoring attribute with this value: ${key}.`);
        return;
      }
      default:
        Log.warn(`The type: ${type} not exist. Ignoring attribute ${key}.`);
    }
  }

  private static getAttributes(params?: BatchSDK.EventDataParams): { [key: string]: ITypedEventAttribute } {
    let attributes = {};

    if (params && params.attributes) {
      let index = 0;
      for (const [key, value] of Object.entries(params.attributes)) {
        if (index >= Consts.MaxEventAttributesCount) {
          Log.warn(logModuleName, `Cannot have more than ${Consts.MaxEventAttributesCount} attributes.`);
          return attributes;
        }

        if (this.keyAndValueValid(key, value)) {
          if (isTypedAttributeValue(value)) {
            const attribute: { [key: string]: string | boolean | number | URL | Date } = {};
            try {
              const valueConverted = this.convertValueAttribute(key, value);
              if (valueConverted !== undefined) {
                attribute[`${key.toLowerCase()}.${value.type}`] = valueConverted;
                attributes = { ...attributes, ...attribute };
              }
            } catch (e) {
              Log.error(logModuleName, "Error when auto-detecting attributes:", e);
            }
          } else {
            try {
              const attribute = this.autoDetectNoTypedAttribute(key, value);
              if (attribute !== undefined) {
                attributes = { ...attributes, ...attribute };
              }
            } catch (e) {
              Log.error(logModuleName, "Error while converted attributes:", e);
            }
          }
        }

        index += 1;
      }
    }

    return attributes;
  }

  private static getLabel(label?: string | null): string | undefined | null {
    if (isString(label)) {
      if (label.length === 0 || label.length > Consts.EventDataLabelMaxLength) {
        Log.warn(`Label can't be empty or longer than ${Consts.EventDataLabelMaxLength} characters. Ignoring label ${label}.`);
        return;
      }
    } else if (label != null && typeof label !== "undefined") {
      Log.warn(`If supplied, label argument must be a string. Ignoring label ${label}.`);
      return;
    }
    return label;
  }

  private static keyAndValueValid(key: string, value: unknown): boolean {
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

    if (typeof value === "undefined" || value === null) {
      Log.warn(logModuleName, `value cannot be undefined or null. Ignoring attribute ${key}.`);
      return false;
    }

    return true;
  }
}
