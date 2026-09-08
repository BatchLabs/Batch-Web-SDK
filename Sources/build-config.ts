declare const process:
  | {
      env: {
        [key: string]: string | undefined;
      };
    }
  | undefined;

function readString(value: string | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

const ENV_BATCH_SDK_VERSION = process!.env.BATCH_SDK_VERSION;
const ENV_BATCH_SDK_MAJOR_VERSION = process!.env.BATCH_SDK_MAJOR_VERSION;
const ENV_BATCH_STATIC_HOST = process!.env.BATCH_STATIC_HOST;
const ENV_BATCH_WS_URL = process!.env.BATCH_WS_URL;
const ENV_BATCH_ICONS_URL = process!.env.BATCH_ICONS_URL;
const ENV_BATCH_ENV = process!.env.BATCH_ENV;
const ENV_BATCH_IS_WEBPACK_DEV_SERVER = process!.env.BATCH_IS_WEBPACK_DEV_SERVER;
const ENV_NPM_PACKAGE_VERSION = typeof process !== "undefined" ? process.env.npm_package_version : undefined;
const ENV_SDK_TARGET_ENV = typeof process !== "undefined" ? process.env.SDK_TARGET_ENV : undefined;
const ENV_SDK_IS_WEBPACK_DEV_SERVER = typeof process !== "undefined" ? process.env.SDK_IS_WEBPACK_DEV_SERVER : undefined;

export const BUILD_SDK_VERSION = readString(ENV_BATCH_SDK_VERSION, readString(ENV_NPM_PACKAGE_VERSION, "0.0.0-test"));
export const BUILD_SDK_MAJOR_VERSION = readString(
  ENV_BATCH_SDK_MAJOR_VERSION,
  BUILD_SDK_VERSION === "rolling" ? "rolling" : BUILD_SDK_VERSION.split(".")[0] || "0"
);
export const BUILD_STATIC_HOST = readString(ENV_BATCH_STATIC_HOST, "localhost");
export const BUILD_WS_URL = readString(ENV_BATCH_WS_URL, "https://ws.test");
export const BUILD_ICONS_URL = readString(ENV_BATCH_ICONS_URL, "https://icons.test");
export const BUILD_ENV = readString(ENV_BATCH_ENV, readString(ENV_SDK_TARGET_ENV, "test"));
export const BUILD_IS_WEBPACK_DEV_SERVER = readString(ENV_BATCH_IS_WEBPACK_DEV_SERVER, readString(ENV_SDK_IS_WEBPACK_DEV_SERVER, "0"));
