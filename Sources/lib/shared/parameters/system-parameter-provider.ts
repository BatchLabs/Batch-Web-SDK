import { SDK_API_LVL } from "../../../config";
import BatchError from "../batch-error";
import { SystemKeys } from "./keys.system";
import { IReadonlyParameterProvider } from "./parameters";

class SystemParameterProvider implements IReadonlyParameterProvider<string> {
  public getParameterForKey(key: SystemKeys): Promise<string> {
    return new Promise(resolve => {
      switch (key) {
        case SystemKeys.SDKAPILevel:
          resolve(SDK_API_LVL);
          break;
        case SystemKeys.DeviceTimezone:
          resolve(SystemParameterProvider.getTimezone() || "");
          break;
        case SystemKeys.DeviceTimezoneOffset:
          resolve(new Date().getTimezoneOffset().toString());
          break;
        case SystemKeys.DeviceLanguage:
          {
            const navigator = self.navigator;
            if (navigator != null) {
              resolve(navigator.language);
            } else {
              resolve("");
            }
          }
          break;
        case SystemKeys.DeviceDate:
          resolve(new Date().toISOString());
          break;
        default:
          throw new BatchError(`${key} is not a managed system key`);
      }
    });
  }

  private static getTimezone(): string | null {
    if (self.Intl) {
      const autoTZ = self.Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (autoTZ) {
        return autoTZ;
      }
    }
    return null;
  }
}
export default SystemParameterProvider;
