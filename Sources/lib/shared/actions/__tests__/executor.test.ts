/* eslint-env jest */

import {
  clipboardAction,
  CopyToClipboardPort,
  deeplinkAction,
  dismissAction,
  formSubmitTrackEventAction,
  groupAction,
  requestNotificationsAction,
  trackEventAction,
  userTagAction,
} from "com.batch.shared/actions/builtins";
import { ActionContext, RenderEventAttributes } from "com.batch.shared/actions/contracts";
import { MessageActionExecutor } from "com.batch.shared/actions/executor";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

interface SdkGatewayStub {
  trackEvent(name: string, attributes?: RenderEventAttributes): Promise<void>;
  updateUserTag(action: "add" | "remove", collection: string, tag: string): Promise<void>;
  showUIElement(componentName: string, force?: boolean): Promise<void>;
}

function makeClipboardStub(): { copyToClipboard: CopyToClipboardPort } {
  return {
    copyToClipboard: async () => undefined,
  };
}

function makeSdkGatewayStub(): SdkGatewayStub {
  return {
    trackEvent: async () => undefined,
    updateUserTag: async () => undefined,
    showUIElement: async () => undefined,
  };
}

function makeExecutor(
  sdkGateway: SdkGatewayStub = makeSdkGatewayStub(),
  clipboard: { copyToClipboard: CopyToClipboardPort } = makeClipboardStub()
): MessageActionExecutor {
  const executor = new MessageActionExecutor();
  executor.register("batch.dismiss", dismissAction);
  executor.register("dismiss", dismissAction);
  executor.register("batch.deeplink", deeplinkAction());
  executor.register(
    "batch.clipboard",
    clipboardAction(text => clipboard.copyToClipboard(text))
  );
  executor.register("batch.group", groupAction(executor));
  executor.register(
    "batch.user.event",
    trackEventAction((name, attributes) => sdkGateway.trackEvent(name, attributes))
  );
  executor.register(
    "batch.user.tag",
    userTagAction((action, collection, tag) => sdkGateway.updateUserTag(action, collection, tag))
  );
  executor.register(
    "batch.request_notifications",
    requestNotificationsAction((component, force) => sdkGateway.showUIElement(component, force))
  );
  executor.register(
    "batch.form.submit",
    formSubmitTrackEventAction((name, attributes) => sdkGateway.trackEvent(name, attributes))
  );
  return executor;
}

describe("MessageActionExecutor", () => {
  test("batch.dismiss returns a dismiss result", async () => {
    const executor = makeExecutor();

    await expect(executor.execute({ action: "batch.dismiss" })).resolves.toEqual({ kind: "dismiss" });
  });

  test("batch.deeplink returns an open window intent for safe URLs", async () => {
    const executor = makeExecutor();

    await expect(
      executor.execute({
        action: "batch.deeplink",
        args: {
          l: "https://batch.com",
        },
      })
    ).resolves.toEqual({
      kind: "open_window",
      openWindow: {
        url: "https://batch.com",
        target: "_blank",
        features: "noopener",
      },
    });
  });

  test("batch.deeplink honours li=true for same-tab navigation", async () => {
    const executor = makeExecutor();

    await expect(
      executor.execute({
        action: "batch.deeplink",
        args: {
          l: "https://batch.com/landing",
          li: true,
        },
      })
    ).resolves.toEqual({
      kind: "open_window",
      openWindow: {
        url: "https://batch.com/landing",
        target: "_self",
        features: "noopener",
      },
    });
  });

  test("batch.deeplink reads l/li only", async () => {
    const executor = makeExecutor();

    await expect(
      executor.execute({
        action: "batch.deeplink",
        args: {
          l: "https://batch.com/deeplink",
          li: false,
        },
      })
    ).resolves.toEqual({
      kind: "open_window",
      openWindow: {
        url: "https://batch.com/deeplink",
        target: "_blank",
        features: "noopener",
      },
    });
  });

  test("batch.deeplink falls back to dismiss for unsafe URLs", async () => {
    const executor = makeExecutor();

    await expect(
      executor.execute({
        action: "batch.deeplink",
        args: {
          l: "javascript:alert(1)",
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });
  });

  test("batch.deeplink falls back to dismiss when the url param is missing", async () => {
    const executor = makeExecutor();

    await expect(executor.execute({ action: "batch.deeplink", args: {} })).resolves.toEqual({ kind: "dismiss" });
  });

  test("batch.user.event delegates to the SDK gateway", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.user.event",
        args: {
          e: "survey_reply",
          l: "2021_opinion",
          a: { response: "option_a" },
          t: ["winter-sale"],
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });

    expect(trackEventSpy).toHaveBeenCalledWith("survey_reply", {
      response: "option_a",
      $label: "2021_opinion",
      $tags: ["winter-sale"],
    });
  });

  test("batch.form.submit tracks an event with the attributes the payload declares", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.form.submit",
        args: {
          e: "form_submitted",
          a: { email: "user@example.com", optin: true, topics: ["a", "b"] },
        },
      })
    ).resolves.toEqual({ kind: "form-feedback", status: "success" });

    expect(trackEventSpy).toHaveBeenCalledWith("form_submitted", { email: "user@example.com", optin: true, topics: ["a", "b"] });
  });

  test("batch.form.submit ignores the collected field values", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await executor.execute(
      { action: "batch.form.submit", args: { e: "form_submitted", a: { source: "payload" } } },
      { formFields: { email: { type: ProfileAttributeType.STRING, value: "user@example.com" } } }
    );

    expect(trackEventSpy).toHaveBeenCalledWith("form_submitted", { source: "payload" });
  });

  test("batch.user.event forwards the whole trackEvent attribute vocabulary unchanged", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);
    const seenAt = new Date("2026-03-04T05:06:07.000Z");

    await executor.execute({
      action: "batch.user.event",
      args: {
        e: "typed_event",
        a: {
          quantity: 42,
          seen_at: seenAt,
          optin: true,
          plan: "pro",
          topics: ["a", "b"],
          views: { type: "i", value: "42" },
          site: { type: "u", value: "https://batch.com" },
        },
      },
    });

    expect(trackEventSpy).toHaveBeenCalledWith("typed_event", {
      quantity: 42,
      seen_at: seenAt,
      optin: true,
      plan: "pro",
      topics: ["a", "b"],
      views: { type: "i", value: "42" },
      site: { type: "u", value: "https://batch.com" },
    });
  });

  test.each([
    ["an absent event name", { a: { email: "user@example.com" } }],
    ["no args at all", undefined],
  ])("batch.form.submit skips tracking with %s", async (_label, args) => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(executor.execute({ action: "batch.form.submit", args })).resolves.toEqual({
      kind: "form-feedback",
      status: "success",
    });

    expect(trackEventSpy).not.toHaveBeenCalled();
  });

  test("batch.form.submit is a reserved identifier", () => {
    const executor = makeExecutor();

    expect(() => executor.registerAction("batch.form.submit", jest.fn())).toThrow("identifier is reserved");
    expect(executor.hasAction("batch.form.submit")).toBe(true);
  });

  test("batch.user.tag delegates to the SDK gateway", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const updateUserTagSpy = jest.spyOn(sdkGateway, "updateUserTag").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.user.tag",
        args: {
          a: "add",
          c: "interests",
          t: "sports",
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });

    expect(updateUserTagSpy).toHaveBeenCalledWith("add", "interests", "sports");
  });

  test("batch.user.tag rejects non-string operations", async () => {
    const executor = makeExecutor();

    await expect(
      executor.execute({
        action: "batch.user.tag",
        args: {
          a: true,
          c: "interests",
          t: "sports",
        },
      })
    ).rejects.toThrow("invalid user tag operation");
  });

  test("batch.user.tag supports removal", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const updateUserTagSpy = jest.spyOn(sdkGateway, "updateUserTag").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.user.tag",
        args: {
          a: "remove",
          c: "interests",
          t: "sports",
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });

    expect(updateUserTagSpy).toHaveBeenCalledWith("remove", "interests", "sports");
  });

  test("batch.group executes nested actions sequentially and keeps the first actionable intent", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const updateUserTagSpy = jest.spyOn(sdkGateway, "updateUserTag").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [
            ["batch.user.event", { e: "group_clicked", a: { source: "demo" } }],
            ["batch.user.tag", { a: "add", c: "interests", t: "group-demo" }],
            ["batch.deeplink", { l: "https://batch.com/landing" }],
          ],
        },
      })
    ).resolves.toEqual({
      kind: "open_window",
      openWindow: {
        url: "https://batch.com/landing",
        target: "_blank",
        features: "noopener",
      },
    });

    expect(trackEventSpy).toHaveBeenCalledWith("group_clicked", {
      source: "demo",
    });
    expect(updateUserTagSpy).toHaveBeenCalledWith("add", "interests", "group-demo");
  });

  test("batch.group hands the ambient context to every sub-action", async () => {
    const executor = makeExecutor();
    const seen: unknown[] = [];
    executor.registerAction("spy", (_args, context) => {
      seen.push(context);
      return { kind: "none" };
    });
    const context: ActionContext = { formFields: { email: { type: ProfileAttributeType.STRING, value: "a@b.c" } } };

    await executor.execute(
      {
        action: "batch.group",
        args: {
          actions: [
            ["spy", {}],
            ["spy", {}],
          ],
        },
      },
      context
    );

    expect(seen).toEqual([context, context]);
  });

  test("batch.group returns the submit success and attaches the redirect grouped after it", async () => {
    const executor = makeExecutor();
    executor.registerAction("submit", () => ({ kind: "form-feedback", status: "success" }));

    await expect(
      executor.execute(
        {
          action: "batch.group",
          args: {
            actions: [
              ["submit", {}],
              ["batch.deeplink", { l: "https://batch.com/thanks", li: true }],
            ],
          },
        },
        { formFields: {} }
      )
    ).resolves.toEqual({
      kind: "form-feedback",
      status: "success",
      openWindow: { url: "https://batch.com/thanks", target: "_self", features: "noopener" },
    });
  });

  test("batch.group keeps the first grouped redirect after a submit success", async () => {
    const executor = makeExecutor();
    executor.registerAction("submit", () => ({ kind: "form-feedback", status: "success" }));

    await expect(
      executor.execute(
        {
          action: "batch.group",
          args: {
            actions: [
              ["submit", {}],
              ["batch.deeplink", { l: "https://batch.com/first" }],
              ["batch.deeplink", { l: "https://batch.com/second" }],
            ],
          },
        },
        { formFields: {} }
      )
    ).resolves.toEqual({
      kind: "form-feedback",
      status: "success",
      openWindow: { url: "https://batch.com/first", target: "_blank", features: "noopener" },
    });
  });

  test("batch.group keeps an actionable intent that a later dismiss follows", async () => {
    const executor = makeExecutor();

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [["batch.deeplink", { l: "https://batch.com/keep" }], ["batch.dismiss"]],
        },
      })
    ).resolves.toEqual({
      kind: "open_window",
      openWindow: { url: "https://batch.com/keep", target: "_blank", features: "noopener" },
    });
  });

  test("batch.group skips a nested batch.group whole: its own sub-actions never run", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [
            ["batch.group", { actions: [["batch.user.event", { e: "nested_never" }]] }],
            ["batch.user.event", { e: "after_nested" }],
          ],
        },
      })
    ).resolves.toEqual({ kind: "none" });

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith("after_nested", {});
    expect(trackEventSpy).not.toHaveBeenCalledWith("nested_never", expect.anything());
  });

  test("batch.group steps over a none result and still resolves the later intent", async () => {
    const executor = makeExecutor();
    executor.registerAction("inert", () => ({ kind: "none" }));

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [
            ["inert", {}],
            ["batch.deeplink", { l: "https://batch.com/after-none" }],
          ],
        },
      })
    ).resolves.toEqual({
      kind: "open_window",
      openWindow: { url: "https://batch.com/after-none", target: "_blank", features: "noopener" },
    });
  });

  test("batch.group recognizes a nested group whatever its case and padding", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [
            [" BATCH.GROUP ", { actions: [["batch.user.event", { e: "nested_never" }]] }],
            ["batch.user.event", { e: "after_nested" }],
          ],
        },
      })
    ).resolves.toEqual({ kind: "none" });

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith("after_nested", {});
  });

  test("batch.group keeps the redirect when a dismiss follows the submit success", async () => {
    const executor = makeExecutor();
    executor.registerAction("submit", () => ({ kind: "form-feedback", status: "success" }));

    await expect(
      executor.execute(
        {
          action: "batch.group",
          args: {
            actions: [["submit", {}], ["batch.deeplink", { l: "https://batch.com/kept" }], ["batch.dismiss"]],
          },
        },
        { formFields: {} }
      )
    ).resolves.toEqual({
      kind: "form-feedback",
      status: "success",
      openWindow: { url: "https://batch.com/kept", target: "_blank", features: "noopener" },
    });
  });

  test("batch.group stops at a failed submit: the grouped redirect never runs", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);
    const fieldErrors = { email: "Invalid" };
    executor.registerAction("submit", () => ({ kind: "form-feedback", status: "error", fieldErrors }));

    await expect(
      executor.execute(
        {
          action: "batch.group",
          args: {
            actions: [
              ["submit", {}],
              ["batch.deeplink", { l: "https://batch.com/thanks", li: true }],
              ["batch.user.event", { e: "never" }],
            ],
          },
        },
        { formFields: {} }
      )
    ).resolves.toEqual({ kind: "form-feedback", status: "error", fieldErrors });

    expect(trackEventSpy).not.toHaveBeenCalled();
  });

  test("batch.group skips nested batch.group actions and keeps executing the rest", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [
            ["batch.group", { actions: [["batch.dismiss"]] }],
            ["batch.user.event", { e: "after_nested" }],
          ],
        },
      })
    ).resolves.toEqual({ kind: "none" });

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy.mock.calls[0][0]).toBe("after_nested");
  });

  test("unknown actions log a public error and degrade to none", async () => {
    const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
    const executor = makeExecutor();

    await expect(executor.execute({ action: "demo.unknown" })).resolves.toEqual({ kind: "none" });

    expect(publicErrorSpy).toHaveBeenCalledWith(
      '[Message] No handler registered for message action "demo.unknown". Did you forget to register it?'
    );
  });

  test("batch.request_notifications delegates force=true to the SDK gateway", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const showUIElementSpy = jest.spyOn(sdkGateway, "showUIElement").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.request_notifications",
        args: {
          force: true,
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });

    expect(showUIElementSpy).toHaveBeenCalledWith("native", true);
  });

  test("batch.request_notifications accepts string force values", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const showUIElementSpy = jest.spyOn(sdkGateway, "showUIElement").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.request_notifications",
        args: {
          f: "true",
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });

    expect(showUIElementSpy).toHaveBeenCalledWith("native", true);
  });

  test("batch.request_notifications forwards the requested UI component", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const showUIElementSpy = jest.spyOn(sdkGateway, "showUIElement").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.request_notifications",
        args: {
          c: "alert",
          force: true,
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });

    expect(showUIElementSpy).toHaveBeenCalledWith("alert", true);
  });

  test("batch.clipboard delegates to the clipboard port", async () => {
    const clipboard = makeClipboardStub();
    const copyToClipboardSpy = jest.spyOn(clipboard, "copyToClipboard").mockResolvedValue(undefined);
    const executor = makeExecutor(undefined, clipboard);

    await expect(
      executor.execute({
        action: "batch.clipboard",
        args: {
          t: "PROMO2024",
        },
      })
    ).resolves.toEqual({ kind: "dismiss" });

    expect(copyToClipboardSpy).toHaveBeenCalledWith("PROMO2024");
  });

  test("batch.clipboard rejects on empty text", async () => {
    const executor = makeExecutor();

    await expect(
      executor.execute({
        action: "batch.clipboard",
        args: {},
      })
    ).rejects.toThrow("Cannot copy to clipboard: empty text");
  });

  test("registerAction executes custom handlers case-insensitively", async () => {
    const executor = makeExecutor();
    const handler = jest.fn().mockResolvedValue({ kind: "none" });

    executor.registerAction("Demo.Custom_Action", handler);

    await expect(executor.execute({ action: "demo.custom_action", args: { source: "test" } })).resolves.toEqual({ kind: "none" });
    expect(handler).toHaveBeenCalledWith({ source: "test" }, {});
    expect(executor.hasAction("DEMO.CUSTOM_ACTION")).toBe(true);
  });

  test("registerAction replaces an existing custom handler", async () => {
    const executor = makeExecutor();

    executor.registerAction("demo.replace_me", jest.fn().mockResolvedValue({ kind: "dismiss" }));
    executor.registerAction("demo.replace_me", jest.fn().mockResolvedValue({ kind: "none" }));

    await expect(executor.execute({ action: "demo.replace_me" })).resolves.toEqual({ kind: "none" });
  });

  test("unregisterAction degrades to none when the custom handler is removed", async () => {
    const executor = makeExecutor();
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

    executor.registerAction("demo.unregister_me", jest.fn().mockResolvedValue({ kind: "none" }));
    executor.unregisterAction("demo.unregister_me");

    await expect(executor.execute({ action: "demo.unregister_me" })).resolves.toEqual({ kind: "none" });
    expect(executor.hasAction("demo.unregister_me")).toBe(false);
    expect(publicError).toHaveBeenCalledWith(expect.stringContaining("demo.unregister_me"));
    publicError.mockRestore();
  });

  test("registerAction rejects reserved built-in names", () => {
    const executor = makeExecutor();

    expect(() => executor.registerAction("batch.dismiss", jest.fn())).toThrow("identifier is reserved");
    expect(() => executor.registerAction("batch.custom", jest.fn())).toThrow("identifier is reserved");
    expect(executor.hasAction("batch.dismiss")).toBe(true);
  });

  test("the bare dismiss identifier resolves to a dismiss result", async () => {
    const executor = makeExecutor();

    await expect(executor.execute({ action: "dismiss" })).resolves.toEqual({ kind: "dismiss" });
  });

  test("registerAction rejects non-function handlers", () => {
    const executor = makeExecutor();

    expect(() => executor.registerAction("demo.bad", undefined as unknown as () => Promise<never>)).toThrow("handler must be a function");
  });

  test("registerAction rejects an empty identifier", () => {
    const executor = makeExecutor();

    expect(() => executor.registerAction("   ", jest.fn())).toThrow("empty message action identifier");
  });

  test("executing an empty action identifier degrades without dispatching", async () => {
    const executor = makeExecutor();
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

    await expect(executor.execute({ action: "   " })).resolves.toEqual({ kind: "none" });
    expect(publicError).toHaveBeenCalledWith(expect.stringContaining("without an identifier"));
    publicError.mockRestore();
  });

  test("built-in handlers resolve case-insensitively", async () => {
    const executor = makeExecutor();

    await expect(executor.execute({ action: "  BATCH.DISMISS  " })).resolves.toEqual({ kind: "dismiss" });
  });

  test("batch.group with an empty actions array is a no-op resolving to none", async () => {
    const executor = makeExecutor();

    await expect(executor.execute({ action: "batch.group", args: { actions: [] } })).resolves.toEqual({ kind: "none" });
  });

  test("batch.group returns none when every sub-action dismisses", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [["batch.user.event", { e: "step_one" }], ["batch.dismiss"]],
        },
      })
    ).resolves.toEqual({ kind: "none" });

    expect(trackEventSpy).toHaveBeenCalledWith("step_one", {});
  });

  test("batch.group aborts and propagates when a sub-action throws", async () => {
    const sdkGateway = makeSdkGatewayStub();
    const trackEventSpy = jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const updateUserTagSpy = jest.spyOn(sdkGateway, "updateUserTag").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [
            ["batch.user.event", { e: "before_failure" }],
            ["batch.user.tag", { a: "add", c: "interests" }],
            ["batch.user.event", { e: "after_failure" }],
          ],
        },
      })
    ).rejects.toThrow("empty tag value");

    expect(trackEventSpy).toHaveBeenCalledWith("before_failure", {});
    expect(trackEventSpy).not.toHaveBeenCalledWith("after_failure", expect.anything());
    expect(updateUserTagSpy).not.toHaveBeenCalled();
  });

  test("batch.group preserves ordering when resolving the first actionable intent", async () => {
    const sdkGateway = makeSdkGatewayStub();
    jest.spyOn(sdkGateway, "trackEvent").mockResolvedValue(undefined);
    const executor = makeExecutor(sdkGateway);

    await expect(
      executor.execute({
        action: "batch.group",
        args: {
          actions: [
            ["batch.deeplink", { l: "https://batch.com/first" }],
            ["batch.deeplink", { l: "https://batch.com/second" }],
          ],
        },
      })
    ).resolves.toEqual({
      kind: "open_window",
      openWindow: { url: "https://batch.com/first", target: "_blank", features: "noopener" },
    });
  });

  test("batch.clipboard propagates a clipboard port rejection", async () => {
    const clipboard = makeClipboardStub();
    jest.spyOn(clipboard, "copyToClipboard").mockRejectedValue(new Error("Clipboard write denied"));
    const executor = makeExecutor(undefined, clipboard);

    await expect(executor.execute({ action: "batch.clipboard", args: { t: "CODE" } })).rejects.toThrow("Clipboard write denied");
  });

  test("a rejecting custom handler propagates its error through execute", async () => {
    const executor = makeExecutor();

    executor.registerAction("demo.explode", jest.fn().mockRejectedValue(new Error("boom")));

    await expect(executor.execute({ action: "demo.explode" })).rejects.toThrow("boom");
  });
});
