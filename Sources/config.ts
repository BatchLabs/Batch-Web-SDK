import {
  BUILD_ENV,
  BUILD_ICONS_URL,
  BUILD_IS_WEBPACK_DEV_SERVER,
  BUILD_SDK_MAJOR_VERSION,
  BUILD_SDK_VERSION,
  BUILD_STATIC_HOST,
  BUILD_WS_URL,
} from "./build-config";

export const SDK_API_LVL = "51";
export const SDK_VERSION = BUILD_SDK_VERSION;
export const SDK_MAJOR_VERSION = BUILD_SDK_MAJOR_VERSION;
export const SDK_DISMISS_NOTIF_AFTER = 30;
export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_MIN_INTERVAL_MS = 1000;
export const SSL_SCRIPT_URL = BUILD_STATIC_HOST;
export const WS_URL = BUILD_WS_URL; // Do not put a trailing slash here
export const ICONS_URL = BUILD_ICONS_URL;
export const IS_DEV = BUILD_ENV === "dev";
export const IS_TEST = BUILD_ENV === "test";
export const IS_WEBPACK_DEV_SERVER = BUILD_IS_WEBPACK_DEV_SERVER == "1";
