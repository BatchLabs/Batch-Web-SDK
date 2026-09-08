// oxlint-disable-next-line import/no-unassigned-import -- installs the IndexedDB globals for jsdom
require("fake-indexeddb/auto");

// jsdom on Jest 27 does not expose TextEncoder and TextDecoder on global.
const { TextEncoder, TextDecoder } = require("util");
const sdkPackage = require("./package.json");

process.env.BATCH_STATIC_HOST = "//test.secure";
process.env.BATCH_WS_URL = "https://ws.secure";
process.env.BATCH_ICONS_URL = "https://icons.secure";
process.env.BATCH_ENV = "test";
process.env.BATCH_IS_WEBPACK_DEV_SERVER = "0";
process.env.BATCH_SDK_VERSION = sdkPackage.version;
process.env.BATCH_SDK_MAJOR_VERSION = sdkPackage.majorVersion;

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
