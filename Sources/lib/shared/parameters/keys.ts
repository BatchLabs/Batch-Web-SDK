import { ProfileKeys } from "./keys.profile";
import { SessionKeys } from "./keys.session";
import { SystemKeys } from "./keys.system";

function getValuesArrayForStringEnum(e: { [key: string]: string }): string[] {
  return Object.keys(e).map(key => e[key]);
}

/*
{
  system: ['da', 'dla', ...],
}
 */
export const allowedKeyByProvider = {
  profile: getValuesArrayForStringEnum(ProfileKeys),
  session: getValuesArrayForStringEnum(SessionKeys),
  system: getValuesArrayForStringEnum(SystemKeys),
};

/*
{
  system: {
    DeviceDate: 'da',
    ...
  }
}
 */
export const keysByProvider = {
  profile: ProfileKeys,
  session: SessionKeys,
  system: SystemKeys,
};
