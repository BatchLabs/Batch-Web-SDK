/* eslint-env jest */

import { MessageActionExecutor } from "com.batch.shared/actions/executor";

import { createCoreActionExecutor } from "../core-action-registry";

describe("createCoreActionExecutor", () => {
  afterEach(() => jest.clearAllMocks());

  function makeHost(): {
    executor: MessageActionExecutor;
    trackEvent: jest.Mock;
    showUIComponent: jest.Mock;
    updateUserTag: jest.Mock;
  } {
    const trackEvent = jest.fn();
    const showUIComponent = jest.fn(async () => undefined);
    const updateUserTag = jest.fn(async () => undefined);
    const executor = createCoreActionExecutor({ trackEvent, showUIComponent, updateUserTag });
    return { executor, trackEvent, showUIComponent, updateUserTag };
  }

  test("only the prefixed deeplink identifier resolves", async () => {
    const { executor } = makeHost();

    expect(executor.hasAction("batch.deeplink")).toBe(true);
    expect(executor.hasAction("deeplink")).toBe(false);
    expect(executor.hasAction("openurl")).toBe(false);
    await expect(executor.execute({ action: "openurl", args: { l: "https://batch.com" } })).resolves.toEqual({ kind: "none" });
  });

  test("batch.user.tag reaches the profile tag port", async () => {
    const { executor, updateUserTag } = makeHost();

    const outcome = await executor.execute({ action: "batch.user.tag", args: { a: "add", c: "interests", t: "sports" } });

    expect(updateUserTag).toHaveBeenCalledWith("add", "interests", "sports");
    expect(outcome).toEqual({ kind: "dismiss" });
  });

  test("batch.user.event reaches the Core trackEvent port", async () => {
    const { executor, trackEvent } = makeHost();

    await executor.execute({ action: "batch.user.event", args: { e: "demo_event", l: "label" } });

    expect(trackEvent).toHaveBeenCalledWith("demo_event", expect.objectContaining({ $label: "label" }));
  });

  test("batch.user.event forwards typed attribute values untouched", async () => {
    const { executor, trackEvent } = makeHost();
    const orderedAt = new Date("2026-01-02T03:04:05.000Z");

    await executor.execute({
      action: "batch.user.event",
      args: { e: "typed_event", a: { quantity: 3, ordered_at: orderedAt, premium: true, ref: "abc" } },
    });

    expect(trackEvent).toHaveBeenCalledWith("typed_event", {
      quantity: 3,
      ordered_at: orderedAt,
      premium: true,
      ref: "abc",
    });
  });

  test("batch.form.submit forwards its attributes to the Core trackEvent port", async () => {
    const { executor, trackEvent } = makeHost();

    const outcome = await executor.execute({
      action: "batch.form.submit",
      args: { e: "form_submitted", a: { email: "user@example.com", optin: true, views: { type: "i", value: "42" }, empty: null } },
    });

    expect(trackEvent).toHaveBeenCalledWith("form_submitted", {
      email: "user@example.com",
      optin: true,
      views: { type: "i", value: "42" },
    });
    expect(outcome).toEqual({ kind: "form-feedback", status: "success" });
  });

  test("batch.request_notifications reaches the UI component port", async () => {
    const { executor, showUIComponent } = makeHost();

    await executor.execute({ action: "batch.request_notifications", args: {} });

    expect(showUIComponent).toHaveBeenCalledWith("native", false);
  });

  test("batch.deeplink stays a browser intent (no Core involved)", async () => {
    const { executor, trackEvent } = makeHost();

    const outcome = await executor.execute({ action: "batch.deeplink", args: { l: "https://batch.com" } });

    expect(outcome).toEqual({
      kind: "open_window",
      openWindow: { url: "https://batch.com", target: "_blank", features: "noopener" },
    });
    expect(trackEvent).not.toHaveBeenCalled();
  });

  test("batch.group resolves sub-actions through the same registry", async () => {
    const { executor, trackEvent } = makeHost();

    const outcome = await executor.execute({
      action: "batch.group",
      args: {
        actions: [
          ["batch.user.event", { e: "grouped" }],
          ["batch.deeplink", { l: "https://batch.com" }],
        ],
      },
    });

    expect(trackEvent).toHaveBeenCalledWith("grouped", expect.any(Object));
    expect(outcome.kind).toBe("open_window");
  });

  test("custom registration cannot claim the batch namespace nor host actions", () => {
    const { executor } = makeHost();

    expect(() => executor.registerAction("batch.evil", async () => ({ kind: "none" }))).toThrow(/reserved/);
    expect(() => executor.registerAction("dismiss", async () => ({ kind: "none" }))).toThrow(/reserved/);
    expect(() => executor.registerAction("my-action", async () => ({ kind: "none" }))).not.toThrow();
  });
});
