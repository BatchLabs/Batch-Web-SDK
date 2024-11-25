import { Consts } from "com.batch.shared/constants/user";
import {
  EventAttributeType,
  isExplicitTypedObjectArray,
  isObjectArray,
  isObjectAttribute,
  isStringArray,
  ObjectEventAttribute,
  TypedEventAttributeType,
} from "com.batch.shared/event/event-types";
import objectDepth from "com.batch.shared/helpers/object-depth";
import { isArray, isBoolean, isDate, isFloat, isNumber, isString, isURL } from "com.batch.shared/helpers/primitive";
import { isTypedEventAttributeValue } from "com.batch.shared/helpers/typed-attribute";
import { Log } from "com.batch.shared/logger";

import { BatchSDK } from "../../../public/types/public-api";

const logModuleName = "Event Data";

export class EventData {
  public tags: string[];
  public label?: string;
  public attributes: { [key: string]: EventAttributeType };

  public constructor(params?: BatchSDK.EventDataParams) {
    const label = this.getLabel(params?.attributes?.$label);
    if (label) {
      this.label = label;
    }

    this.tags = this.getTags(params);
    this.attributes = this.getAttributes(params?.attributes);
  }

  private keyAndValueValid(key: string, value: unknown): boolean {
    if (!isString(key)) {
      Log.warn(logModuleName, "key must be a string.");
      return false;
    }

    // Reserved keys
    if (key === "$label" || key === "$tags") {
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

  private getLabel(label?: string | null): string | undefined | null {
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

  private getTags(params?: BatchSDK.EventDataParams): string[] {
    const tags: Set<string> = new Set();
    if (params?.attributes?.$tags) {
      params.attributes.$tags.forEach((tag: string, index: number) => {
        if (index >= Consts.MaxEventArrayAttributesCount) {
          Log.warn(logModuleName, `Tags can't be longer than ${Consts.MaxEventArrayAttributesCount} elements. Ignoring tag ${tag}`);
          return;
        }
        if (typeof tag === "undefined") {
          Log.warn(logModuleName, "A tag is required.");
          return;
        }

        if (isString(tag)) {
          if (tag.length === 0 || tag.length > Consts.EventDataTagMaxLength) {
            Log.warn(logModuleName, `Tags can't be empty or longer than ${Consts.EventDataTagMaxLength} characters. Ignoring tag ${tag}.`);
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

  private getAttributes(params?: BatchSDK.EventDataAttributeType): { [key: string]: EventAttributeType } {
    let attributes = {};

    if (params) {
      let index = 0;
      for (const [key, value] of Object.entries(params)) {
        if (index >= Consts.MaxEventAttributesCount) {
          Log.warn(logModuleName, `Cannot have more than ${Consts.MaxEventAttributesCount} attributes.`);
          return attributes;
        }

        if (this.keyAndValueValid(key, value)) {
          if (isTypedEventAttributeValue(value)) {
            const attribute: { [key: string]: EventAttributeType } = {};
            try {
              const valueConverted = this.parseTypedEventAttribute(key, value);
              if (valueConverted !== undefined) {
                attribute[`${key.toLowerCase()}.${value.type}`] = valueConverted;
                attributes = { ...attributes, ...attribute };
              }
            } catch (e) {
              Log.error(logModuleName, "Error while parsing typed attributes:", e);
            }
          } else {
            try {
              const attribute = this.autoDetectNoTypedAttribute(key, value);
              if (attribute !== undefined) {
                attributes = { ...attributes, ...attribute };
              }
            } catch (e) {
              Log.error(logModuleName, "Error when auto-detecting attributes:", e);
            }
          }
        }

        index += 1;
      }
    }

    return attributes;
  }

  private parseTypedEventAttribute(key: string, v: BatchSDK.EventAttributeValue): EventAttributeType | undefined {
    const type = v.type;
    const value: unknown = v.value;
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
          if (value.length === 0 || value.length > Consts.EventDataStringMaxLength) {
            Log.warn(
              logModuleName,
              `String attribute value can't be empty or longer than ${Consts.EventDataStringMaxLength} characters. 
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
      case TypedEventAttributeType.ARRAY: {
        if (isArray(value)) {
          if (value.length > 0 && !value.every(it => !isArray(it))) {
            Log.warn(logModuleName, `Attribute of type Array cannot have array values. Ignoring attribute with this value: ${key}.`);
            return;
          }
          if (value.length > Consts.MaxEventArrayItems) {
            Log.warn(
              logModuleName,
              `Array attributes cannot have more than ${Consts.MaxEventArrayItems} items. Ignoring attribute with this value: ${key}.`
            );
            return;
          }
          // Check if we have an array of explicit typed attribute
          if (value.length > 0 && isExplicitTypedObjectArray(value)) {
            return value.map(obj => this.parseTypedEventAttribute(key, obj) as ObjectEventAttribute);
          }
          // Check if we have an array of objects (no typed attribute)
          if (value.length > 0 && isObjectArray(value)) {
            return value.map(obj => this.getAttributes(obj as BatchSDK.EventDataAttributeType));
          }
          // Simple string array
          if (value.length > 0 && isStringArray(value)) {
            return value;
          }
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the ARRAY type. Must be an Array of String or Object. Ignoring attribute: ${key}.`
        );
        return;
      }
      case TypedEventAttributeType.OBJECT: {
        if (isObjectAttribute(value)) {
          if (objectDepth(value) > Consts.MaxEventObjectDepth) {
            Log.warn(
              logModuleName,
              `Object attributes cannot be deeper than ${Consts.MaxEventObjectDepth}. Ignoring attribute with this value: ${key}.`
            );
            return;
          }
          return { ...this.getAttributes(value as BatchSDK.EventDataAttributeType) };
        }
        Log.warn(
          logModuleName,
          `Invalid attribute value for the OBJECT type. Must be an OBJECT. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      default:
        Log.warn(`The type: ${type} not exist. Ignoring attribute ${key}.`);
    }
  }

  private autoDetectNoTypedAttribute(key: string, value: EventAttributeType): { [key: string]: EventAttributeType } | undefined {
    const attribute: { [key: string]: EventAttributeType } = {};
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
      if (value.length === 0 || value.length > Consts.EventDataStringMaxLength) {
        Log.warn(
          logModuleName,
          `String attribute can't be empty or longer than ${Consts.EventDataStringMaxLength} characters. Ignoring attribute ${key}.`
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
    if (isArray(value)) {
      if (value.length > 0 && isArray(value[0])) {
        Log.warn(logModuleName, `Attribute of type Array cannot have array values. Ignoring attribute with this value: ${key}.`);
        return;
      }
      if (value.length > Consts.MaxEventArrayItems) {
        Log.warn(
          logModuleName,
          `Array attributes cannot have more than ${Consts.MaxEventArrayItems} items. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      // Check if we have an array of explicit typed attribute
      if (value.length > 0 && isExplicitTypedObjectArray(value)) {
        attribute[`${key.toLowerCase()}.${TypedEventAttributeType.ARRAY}`] = value.map(
          obj => this.parseTypedEventAttribute(key, obj) as ObjectEventAttribute
        );
        return attribute;
      }
      // Check if we have an array of objects (no typed attribute)
      if (value.length > 0 && isObjectArray(value)) {
        attribute[`${key.toLowerCase()}.${TypedEventAttributeType.ARRAY}`] = value.map(obj =>
          this.getAttributes(obj as BatchSDK.EventDataAttributeType)
        );
        return attribute;
      }
      // Simple string array
      if (value.length > 0 && isStringArray(value)) {
        attribute[`${key.toLowerCase()}.${TypedEventAttributeType.ARRAY}`] = value;
        return attribute;
      }
      Log.warn(
        logModuleName,
        `Invalid attribute value for the ARRAY type. Must be an Array of String or Object. Ignoring attribute: ${key}.`
      );
      return;
    }
    if (isObjectAttribute(value)) {
      if (objectDepth(value) > Consts.MaxEventObjectDepth) {
        Log.warn(
          logModuleName,
          `Object attributes cannot be deeper than ${Consts.MaxEventObjectDepth}. Ignoring attribute with this value: ${key}.`
        );
        return;
      }
      attribute[`${key.toLowerCase()}.${TypedEventAttributeType.OBJECT}`] = this.getAttributes(value as BatchSDK.EventDataAttributeType);
      return attribute;
    }
    Log.warn(`No type corresponding to this value ${value}. Ignoring attribute ${key}`);
  }
}
