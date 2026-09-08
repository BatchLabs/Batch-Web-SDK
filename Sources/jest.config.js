module.exports = {
  setupFiles: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["tests-e2e", "node_modules", "<rootDir>/\\.stryker-tmp"],
  modulePathIgnorePatterns: ["\\.claude/worktrees"],
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|js)$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript" },
          target: "es2020",
          transform: { useDefineForClassFields: false },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js"],
  moduleNameMapper: {
    // Keep before the alias mappers: an aliased raw CSS asset must resolve to the mock.
    "^.+\\.raw\\.css$": "<rootDir>/src/__mocks__/raw-css.ts",
    "^com\\.batch\\.dom\\/(.*)$": "<rootDir>/src/lib/dom/$1",
    "^com\\.batch\\.shared\\/(.*)$": "<rootDir>/src/lib/shared/$1",
    "^com\\.batch\\.translations\\/(.*)$": "<rootDir>/src/translations/$1",
    "^com\\.batch\\.worker\\/(.*)$": "<rootDir>/src/lib/worker/$1",
  },
  collectCoverage: true,
  coverageDirectory: ".coverage-report",
  coverageReporters: ["json", "lcov", "text-summary"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "\\.d\\.ts$",
    "src/lib/dom/render/contracts\\.ts$",
    "src/lib/shared/actions/contracts\\.ts$",
    "src/lib/dom/render/analytics/messaging-events\\.ts$",
    "src/lib/dom/render/runtime/surface/surface-strategy\\.ts$",
    "src/lib/dom/render/render/field-protocol\\.ts$",
  ],
  ...(process.env.SDK_COVERAGE_GATE === "1"
    ? {
        coverageThreshold: {
          "src/lib/dom/render/": {
            statements: 95,
            branches: 92,
            functions: 92,
            lines: 95,
          },
        },
      }
    : {}),
};
