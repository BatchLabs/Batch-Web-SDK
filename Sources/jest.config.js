/* eslint-env node */

module.exports = {
  globals: {
    BATCH_STATIC_HOST: "//test.secure",
    BATCH_WS_URL: "https://ws.secure",
    BATCH_SAFARI_WS_URL: "https://safari-ws.secure",
    BATCH_ICONS_URL: "https://icons.secure",
    BATCH_ENV: "test",
    BATCH_IS_WEBPACK_DEV_SERVER: "0",
    BATCH_SDK_VERSION: "3.3.0",
    BATCH_SDK_MAJOR_VERSION: "3",
  },
  testPathIgnorePatterns: ["ui-tests", "node_modules"],
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|js)$": "babel-jest",
  },
  moduleFileExtensions: ["ts", "js"],
  moduleNameMapper: {
    "^com\\.batch\\.dom\\/(.*)$": "<rootDir>/src/lib/dom/$1",
    "^com\\.batch\\.shared\\/(.*)$": "<rootDir>/src/lib/shared/$1",
    "^com\\.batch\\.translations\\/(.*)$": "<rootDir>/src/translations/$1",
    "^com\\.batch\\.worker\\/(.*)$": "<rootDir>/src/lib/worker/$1",
  },
  collectCoverage: true,
  coverageDirectory: ".coverage-report",
  coverageReporters: ["json", "lcov", "text-summary"],
};
