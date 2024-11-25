import Event from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import { isSet } from "com.batch.shared/helpers/primitive";
import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";
import {
  isPartialUpdateArrayObject,
  ProfileAttributeType,
  ProfileCustomDataAttributes,
  ProfileNativeAttributeType,
  ProfileNativeDataAttribute,
} from "com.batch.shared/profile/profile-data-types";

type PartialUpdateObject = { $add?: Array<string>; $remove?: Array<string> };
type CustomAttributeType = {
  [key: string]: string | boolean | number | Array<string> | PartialUpdateObject | null;
};

export interface ProfileDataChangedParameters {
  email?: string | null;
  email_marketing?: string;
  device_timezone?: string;
  device_language?: string;
  device_region?: string;
  language?: string | null;
  region?: string | null;
  custom_attributes?: CustomAttributeType;
}

export interface ProfileIdentifyParameters {
  identifiers: {
    custom_id?: string;
    install_id: string;
  };
}

export class ProfileEventBuilder {
  private params: ProfileDataChangedParameters;

  public constructor() {
    this.params = {};
  }

  /**
   * Helper method that format profile's attributes to sends
   * @param attributes Attributes to format
   */
  private convertAttributes(attributes: ProfileCustomDataAttributes): CustomAttributeType {
    const attrs: CustomAttributeType = {};
    for (const [key, attribute] of Object.entries(attributes)) {
      const hintKey = attribute.type !== ProfileAttributeType.UNKNOWN ? `${key.toLowerCase()}.${attribute.type}` : key.toLowerCase();
      if (isPartialUpdateArrayObject(attribute.value)) {
        const partialUpdate: PartialUpdateObject = {};
        if (attribute.value.$add) {
          partialUpdate.$add = Array.from(attribute.value.$add);
        }
        if (attribute.value.$remove) {
          partialUpdate.$remove = Array.from(attribute.value.$remove);
        }
        attrs[hintKey] = partialUpdate;
      } else {
        attrs[hintKey] = isSet(attribute.value) ? Array.from(attribute.value) : attribute.value;
      }
    }
    return attrs;
  }

  public withCustomAttributes(customData: ProfileCustomDataAttributes): ProfileEventBuilder {
    if (Object.keys(customData).length > 0) {
      this.params["custom_attributes"] = this.convertAttributes(customData);
    }
    return this;
  }

  public withSystemParameters(param: { [key: string]: string | null }): ProfileEventBuilder {
    const language = param[ProfileKeys.DeviceLanguage];
    if (language) {
      this.params["device_language"] = language;
    }
    const timezone = param[ProfileKeys.DeviceTimezone];
    if (timezone) {
      this.params["device_timezone"] = timezone;
    }
    return this;
  }

  public withNativeAttributes(nativeData: ProfileNativeDataAttribute[]): ProfileEventBuilder {
    for (const native of nativeData) {
      switch (native.key) {
        case ProfileNativeAttributeType.EMAIL_MARKETING:
        case ProfileNativeAttributeType.DEVICE_LANGUAGE:
        case ProfileNativeAttributeType.DEVICE_TIMEZONE:
          if (native.value) {
            this.params[native.key] = native.value;
          }
          break;
        default:
          this.params[native.key] = native.value;
      }
    }
    return this;
  }

  public build(): Event | null {
    if (Object.keys(this.params).length === 0) {
      return null;
    }
    return new Event(InternalSDKEvent.ProfileDataChanged, this.params);
  }
}
/**
 * Build a profile identify event
 * @param customId user's custom identifier
 * @param installId installation's identifier
 */
export function buildProfileIdentifyEvent(installId: string, customId: string | null): Event {
  const params: ProfileIdentifyParameters = {
    identifiers: {
      install_id: installId,
    },
  };
  if (customId) {
    params.identifiers.custom_id = customId;
  }
  return new Event(InternalSDKEvent.ProfileIdentify, params);
}
