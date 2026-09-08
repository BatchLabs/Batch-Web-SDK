/* eslint-env jest */

import { resolveClipboardText } from "com.batch.shared/actions/clipboard";
import { resolveGroupedActions } from "com.batch.shared/actions/resolve/group";
import { resolveOpenExternalURL } from "com.batch.shared/actions/resolve/open-external-url";
import { resolveRequestNotifications, resolveRequestNotificationsComponent } from "com.batch.shared/actions/resolve/request-notifications";
import { resolveEventAttributes, resolveTrackEvent } from "com.batch.shared/actions/resolve/track-event";
import { resolveUserTag } from "com.batch.shared/actions/resolve/user-tag";

describe("resolveGroupedActions", () => {
  test("resolves array-form entries with action id and args", () => {
    const actions = resolveGroupedActions({
      actions: [["batch.user.event", { e: "clicked" }], ["batch.dismiss"]],
    });

    expect(actions).toEqual([
      { action: "batch.user.event", args: { e: "clicked" } },
      { action: "batch.dismiss", args: {} },
    ]);
  });

  test("resolves object-form entries using action/args keys", () => {
    const actions = resolveGroupedActions({
      actions: [{ action: "batch.user.tag", args: { a: "add", c: "interests", t: "sports" } }],
    });

    expect(actions).toEqual([{ action: "batch.user.tag", args: { a: "add", c: "interests", t: "sports" } }]);
  });

  test("resolves object-form entries using name/params aliases", () => {
    const actions = resolveGroupedActions({
      actions: [{ name: "batch.deeplink", params: { l: "https://batch.com" } }],
    });

    expect(actions).toEqual([{ action: "batch.deeplink", args: { l: "https://batch.com" } }]);
  });

  test("defaults object-form args to an empty object when none is provided", () => {
    const actions = resolveGroupedActions({ actions: [{ action: "batch.dismiss" }] });

    expect(actions).toEqual([{ action: "batch.dismiss", args: {} }]);
  });

  test("resolves to an empty group when the actions array is missing", () => {
    expect(resolveGroupedActions(undefined)).toEqual([]);
    expect(resolveGroupedActions({ actions: "nope" })).toEqual([]);
  });

  test("resolves to an empty group when the actions array is empty", () => {
    expect(resolveGroupedActions({ actions: [] })).toEqual([]);
  });

  test("truncates past 10 actions instead of rejecting the group (native alignment)", () => {
    const actions = Array.from({ length: 12 }, () => ["batch.dismiss"]);

    const resolved = resolveGroupedActions({ actions });

    expect(resolved).toHaveLength(10);
    expect(resolved.every(entry => entry.action === "batch.dismiss")).toBe(true);
  });

  test("skips an array-form entry with no action name and keeps the rest", () => {
    expect(resolveGroupedActions({ actions: [[""], ["batch.dismiss"]] })).toEqual([{ action: "batch.dismiss", args: {} }]);
  });

  test("skips an object-form entry with no action name and keeps the rest", () => {
    expect(resolveGroupedActions({ actions: [{ args: { foo: "bar" } }, { action: "batch.dismiss" }] })).toEqual([
      { action: "batch.dismiss", args: {} },
    ]);
  });
});

describe("resolveRequestNotifications", () => {
  test("defaults to false when nothing is provided", () => {
    expect(resolveRequestNotifications(undefined)).toBe(false);
    expect(resolveRequestNotifications({})).toBe(false);
  });

  test("reads boolean force values", () => {
    expect(resolveRequestNotifications({ force: true })).toBe(true);
    expect(resolveRequestNotifications({ f: false })).toBe(false);
  });

  test("coerces truthy string force values", () => {
    expect(resolveRequestNotifications({ f: "true" })).toBe(true);
    expect(resolveRequestNotifications({ f: "1" })).toBe(true);
  });

  test("coerces falsy string force values", () => {
    expect(resolveRequestNotifications({ f: "false" })).toBe(false);
    expect(resolveRequestNotifications({ f: "0" })).toBe(false);
  });

  test("prefers the short f key over force", () => {
    expect(resolveRequestNotifications({ f: "false", force: true })).toBe(false);
  });

  test("falls back to asBoolean for unrecognized strings", () => {
    expect(resolveRequestNotifications({ f: "maybe" })).toBe(false);
    expect(resolveRequestNotifications({ f: "maybe", force: true })).toBe(true);
  });
});

describe("resolveRequestNotificationsComponent", () => {
  test("defaults to native", () => {
    expect(resolveRequestNotificationsComponent(undefined)).toBe("native");
    expect(resolveRequestNotificationsComponent({})).toBe("native");
  });

  test("reads the short c key and the component alias", () => {
    expect(resolveRequestNotificationsComponent({ c: "alert" })).toBe("alert");
    expect(resolveRequestNotificationsComponent({ component: "banner" })).toBe("banner");
  });

  test("trims and ignores blank component names", () => {
    expect(resolveRequestNotificationsComponent({ c: "  alert  " })).toBe("alert");
    expect(resolveRequestNotificationsComponent({ c: "   " })).toBe("native");
    expect(resolveRequestNotificationsComponent({ c: 42 })).toBe("native");
  });
});

describe("resolveOpenExternalURL", () => {
  test("reads url and in-page flag", () => {
    expect(resolveOpenExternalURL({ l: "https://batch.com", li: true })).toEqual({
      url: "https://batch.com",
      inPageDeeplinks: true,
    });
  });

  test("returns an undefined url when the l param is missing", () => {
    expect(resolveOpenExternalURL({})).toEqual({ url: undefined, inPageDeeplinks: false });
  });

  test("honours the fallback in-page flag", () => {
    expect(resolveOpenExternalURL({ l: "https://batch.com" }, true)).toEqual({
      url: "https://batch.com",
      inPageDeeplinks: true,
    });
  });
});

describe("resolveEventAttributes", () => {
  test("keeps the whole trackEvent attribute vocabulary", () => {
    const orderedAt = new Date("2026-01-02T03:04:05.000Z");
    const site = new URL("https://batch.com/pricing");

    expect(
      resolveEventAttributes({
        ref: "abc",
        premium: true,
        quantity: 3,
        price: 9.99,
        ordered_at: orderedAt,
        site,
        topics: ["a", "b"],
        shipping: { city: "Paris" },
        seen_at: { type: "t", value: 1767225600000 },
        views: { type: "i", value: "42" },
      })
    ).toEqual({
      ref: "abc",
      premium: true,
      quantity: 3,
      price: 9.99,
      ordered_at: orderedAt,
      site,
      topics: ["a", "b"],
      shipping: { city: "Paris" },
      seen_at: { type: "t", value: 1767225600000 },
      views: { type: "i", value: "42" },
    });
  });

  test("drops the values that cannot be an attribute at all", () => {
    expect(
      resolveEventAttributes({
        kept: "value",
        empty: null,
        missing: undefined,
        callback: (): void => undefined,
        token: Symbol("token"),
      })
    ).toEqual({ kept: "value" });
  });

  test("resolves a non-object payload to no attributes", () => {
    expect(resolveEventAttributes(undefined)).toEqual({});
    expect(resolveEventAttributes("nope")).toEqual({});
    expect(resolveEventAttributes(["nope"])).toEqual({});
  });
});

describe("resolveTrackEvent", () => {
  test("resolves event name, label, tags and attributes", () => {
    expect(resolveTrackEvent({ e: "reply", l: "opinion", a: { response: "a" }, t: ["x"] })).toEqual({
      eventName: "reply",
      attributes: { response: "a", $label: "opinion", $tags: ["x"] },
    });
  });

  test("keeps custom attributes alongside the reserved keys", () => {
    const { attributes } = resolveTrackEvent({
      e: "reply",
      l: "opinion",
      t: ["x"],
      a: { response: "a", views: { type: "i", value: "42" } },
    });

    expect(attributes).toEqual({ response: "a", views: { type: "i", value: "42" }, $label: "opinion", $tags: ["x"] });
  });

  test("the resolved label and tags win over the ones carried by the attributes", () => {
    expect(resolveTrackEvent({ e: "reply", l: "opinion", t: ["x"], a: { $label: "stale", $tags: ["stale"] } })).toEqual({
      eventName: "reply",
      attributes: { $label: "opinion", $tags: ["x"] },
    });
  });

  test("omits label and tags when absent", () => {
    expect(resolveTrackEvent({ e: "reply" })).toEqual({ eventName: "reply", attributes: {} });
  });

  test("throws when the event name is empty", () => {
    expect(() => resolveTrackEvent({ a: { response: "a" } })).toThrow("empty event name");
    expect(() => resolveTrackEvent(undefined)).toThrow("empty event name");
  });
});

describe("resolveUserTag", () => {
  test("resolves add and remove operations", () => {
    expect(resolveUserTag({ a: "add", c: "interests", t: "sports" })).toEqual({
      action: "add",
      collection: "interests",
      tag: "sports",
    });
    expect(resolveUserTag({ a: "remove", c: "interests", t: "sports" })).toEqual({
      action: "remove",
      collection: "interests",
      tag: "sports",
    });
  });

  test("throws when the collection is empty", () => {
    expect(() => resolveUserTag({ a: "add", t: "sports" })).toThrow("empty tag collection");
  });

  test("throws when the tag value is empty", () => {
    expect(() => resolveUserTag({ a: "add", c: "interests" })).toThrow("empty tag value");
  });

  test("throws when the operation is invalid", () => {
    expect(() => resolveUserTag({ a: "toggle", c: "interests", t: "sports" })).toThrow("invalid user tag operation");
    expect(() => resolveUserTag({ c: "interests", t: "sports" })).toThrow("invalid user tag operation");
  });
});

describe("resolveClipboardText", () => {
  test("reads the short t key and the text alias", () => {
    expect(resolveClipboardText({ t: "CODE" })).toBe("CODE");
    expect(resolveClipboardText({ text: "CODE" })).toBe("CODE");
  });

  test("throws on empty text", () => {
    expect(() => resolveClipboardText({})).toThrow("empty text");
    expect(() => resolveClipboardText(undefined)).toThrow("empty text");
  });
});
