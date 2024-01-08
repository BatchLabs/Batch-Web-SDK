// ParameterKeys maps human-readable keys to their shortened version
import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";

export enum SystemKeys {
  SDKAPILevel = "lvl",
  DeviceTimezone = "dtz",
  DeviceTimezoneOffset = "dtzo",
  DeviceDate = "da",
  DeviceLanguage = "dla",
}

export type SystemWatchedParameter = SystemKeys.DeviceLanguage | SystemKeys.DeviceTimezone;
export const systemWatchedParameterBinder = {
  [SystemKeys.DeviceLanguage]: ProfileKeys.DeviceLanguage,
  [SystemKeys.DeviceTimezone]: ProfileKeys.DeviceTimezone,
};
