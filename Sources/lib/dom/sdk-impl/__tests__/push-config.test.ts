import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

import { isPushEnabled, normalizePublicConfig } from "../push-config";

function baseConfig(overrides: Partial<IPrivateBatchSDKConfiguration> = {}): IPrivateBatchSDKConfiguration {
  return { apiKey: "key", authKey: "auth", ...overrides };
}

describe("isPushEnabled", () => {
  test("omitted push keeps push enabled (opt-out)", () => {
    expect(isPushEnabled(baseConfig())).toBe(true);
  });

  test("explicit undefined push keeps push enabled", () => {
    expect(isPushEnabled(baseConfig({ push: undefined }))).toBe(true);
  });

  test("a push settings object enables push", () => {
    expect(isPushEnabled(baseConfig({ push: { vapidPublicKey: "vapid" } }))).toBe(true);
  });

  test("push: false disables push", () => {
    expect(isPushEnabled(baseConfig({ push: false }))).toBe(false);
  });

  test("push: null disables push", () => {
    expect(isPushEnabled(baseConfig({ push: null }))).toBe(false);
  });
});

describe("normalizePublicConfig", () => {
  const internal = { origin: "https://example.com", referrer: "https://example.com/" };
  const internalTransient = {};

  test("flattens the push settings to the config root", () => {
    const push = { vapidPublicKey: "vapid", smallIcon: "/s.png", defaultIcon: "/d.png" };
    const result = normalizePublicConfig(baseConfig({ push }), push, internal, internalTransient);

    expect(result.vapidPublicKey).toBe("vapid");
    expect(result.smallIcon).toBe("/s.png");
    expect(result.defaultIcon).toBe("/d.png");
    expect(result.pushEnabled).toBe(true);
  });

  test("drops the public `push` key from the internal config", () => {
    const push = { vapidPublicKey: "vapid" };
    const result = normalizePublicConfig(baseConfig({ push }), push, internal, internalTransient);

    expect("push" in result).toBe(false);
  });

  test("resolves pushEnabled to false and leaves push fields undefined when disabled", () => {
    const result = normalizePublicConfig(baseConfig({ push: false }), undefined, internal, internalTransient);

    expect(result.pushEnabled).toBe(false);
    expect(result.vapidPublicKey).toBeUndefined();
    expect("push" in result).toBe(false);
  });

  test("carries the internal and internalTransient objects", () => {
    const result = normalizePublicConfig(baseConfig(), undefined, internal, internalTransient);

    expect(result.internal).toBe(internal);
    expect(result.internalTransient).toBe(internalTransient);
  });
});
