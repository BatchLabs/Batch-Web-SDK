declare let BATCH_STATIC_HOST: string;
declare let BATCH_WS_URL: string;
declare let BATCH_SAFARI_WS_URL: string;
declare let BATCH_ICONS_URL: string;
declare let BATCH_ENV: string;
declare let BATCH_SDK_VERSION: string;
declare let BATCH_SDK_MAJOR_VERSION: string;
declare let BATCH_IS_WEBPACK_DEV_SERVER: string;

export const SDK_API_LVL = "1";
export const SDK_VERSION = BATCH_SDK_VERSION;
export const SDK_MAJOR_VERSION = BATCH_SDK_MAJOR_VERSION;
export const SDK_DISMISS_NOTIF_AFTER = 30;
export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_MIN_INTERVAL_MS = 1000;
export const SSL_SCRIPT_URL = BATCH_STATIC_HOST;
export const WS_URL = BATCH_WS_URL; // Do not put a trailing slash here
export const SAFARI_WS_URL = BATCH_SAFARI_WS_URL;
export const ICONS_URL = BATCH_ICONS_URL;
export const IS_DEV = BATCH_ENV === "dev";
export const IS_TEST = BATCH_ENV === "test";
export const IS_WEBPACK_DEV_SERVER = BATCH_IS_WEBPACK_DEV_SERVER == "1";
