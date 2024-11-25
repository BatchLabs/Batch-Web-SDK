import { Permission } from "../sdk";

export type SafariPermissionResult = {
  permission: Permission;
  deviceToken?: string;
};

type RequestPermission = {
  permission: (websitePushId: string) => SafariPermissionResult;
  requestPermission: (url: string, websitePushId: string, { installID: string }, callback: (c: SafariPermissionResult) => void) => void;
};

export interface ISafari {
  pushNotification: RequestPermission;
}

declare global {
  interface Window {
    safari: ISafari;
  }
}
