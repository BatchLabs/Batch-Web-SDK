// ParameterKeys maps human-readable keys to their shortened version
import { ProfileNativeAttributeType } from "com.batch.shared/profile/profile-data-types";

export enum ProfileKeys {
  InstallationID = "di",
  CustomIdentifier = "cus",
  UserRegion = "ure",
  UserLanguage = "ula",
  UserProfileVersion = "upv",
  Subscription = "subscription",
  Subscribed = "subscribed",
  LastConfiguration = "lastconfig",
  PushProbation = "outOfProbation",
  ProfileProbation = "outOfProfileProbation",
  // Old probation status, which is set to true when actually out of probation
  // We renamed the key to be more explicit
  LegacyProbation = "probation",
  DeviceLanguage = "deviceLanguage",
  DeviceTimezone = "deviceTimezone",
  ProjectKey = "projectKey",
}

export const indexedDBKeyBinder = {
  [ProfileNativeAttributeType.REGION]: ProfileKeys.UserRegion,
  [ProfileNativeAttributeType.LANGUAGE]: ProfileKeys.UserLanguage,
};
