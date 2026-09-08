/* eslint-env jest */

const STORAGE_KEY = "com.batch.lp.sessionId";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadModule(): typeof import("../landing-session") {
  let mod: typeof import("../landing-session");
  jest.isolateModules(() => {
    mod = require("../landing-session");
  });
  return mod!;
}

afterEach(() => {
  sessionStorage.clear();
  jest.restoreAllMocks();
});

describe("resolveLandingSessionId", () => {
  it("mints a UUID and persists it so a reload keeps the same session", () => {
    const sessionId = loadModule().resolveLandingSessionId();

    expect(sessionId).toMatch(UUID_PATTERN);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(sessionId);
    expect(loadModule().resolveLandingSessionId()).toBe(sessionId);
  });

  it("reuses the stored id rather than minting a second one", () => {
    sessionStorage.setItem(STORAGE_KEY, "session-from-a-previous-page");

    expect(loadModule().resolveLandingSessionId()).toBe("session-from-a-previous-page");
  });

  it("replaces an empty stored value", () => {
    sessionStorage.setItem(STORAGE_KEY, "");

    const sessionId = loadModule().resolveLandingSessionId();
    expect(sessionId).toMatch(UUID_PATTERN);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(sessionId);
  });

  it("never reads the core SDK session key", () => {
    sessionStorage.setItem("com.batch.sessionId", "core-sdk-session");

    const sessionId = loadModule().resolveLandingSessionId();
    expect(sessionId).not.toBe("core-sdk-session");
    expect(sessionStorage.getItem("com.batch.sessionId")).toBe("core-sdk-session");
  });

  it("still yields a stable id when reading storage throws (site data blocked)", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const mod = loadModule();

    const first = mod.resolveLandingSessionId();
    expect(first).toMatch(UUID_PATTERN);
    expect(mod.resolveLandingSessionId()).toBe(first);
  });

  it("still yields a stable id when writing throws (quota or sandboxed iframe)", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const mod = loadModule();

    const first = mod.resolveLandingSessionId();
    expect(first).toMatch(UUID_PATTERN);
    expect(mod.resolveLandingSessionId()).toBe(first);
  });
});
