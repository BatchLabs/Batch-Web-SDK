import { asString } from "com.batch.shared/helpers/primitive";
import { isSafeURL } from "com.batch.shared/helpers/url";
import { Log } from "com.batch.shared/logger";

import { resolveClipboardText } from "./clipboard";
import { ACTION_LOG_MODULE, FORM_SUBMIT_ATTRIBUTES_KEY, FORM_SUBMIT_EVENT_NAME_KEY } from "./constants";
import { ActionOutcome, MessageActionHandler, RenderActionRunner, RenderEventAttributes } from "./contracts";
import { resolveGroupedActions } from "./resolve/group";
import { resolveOpenExternalURL } from "./resolve/open-external-url";
import { resolveRequestNotifications, resolveRequestNotificationsComponent } from "./resolve/request-notifications";
import { resolveEventAttributes, resolveTrackEvent } from "./resolve/track-event";
import { resolveUserTag } from "./resolve/user-tag";

/** Effect ports the factories bind to. Provided by each host. */
export type CopyToClipboardPort = (text: string) => Promise<void>;
export type TrackEventPort = (name: string, attributes?: RenderEventAttributes) => void | Promise<void>;
export type UpdateUserTagPort = (action: "add" | "remove", collection: string, tag: string) => Promise<void>;
export type ShowUIComponentPort = (componentCode: string, force: boolean) => Promise<void>;

export const dismissAction: MessageActionHandler = async () => ({ kind: "dismiss" });

/** Handles `batch.deeplink`. Args: `l` is the URL, `li` opens it in the page. */
export function deeplinkAction(): MessageActionHandler {
  return async args => {
    const { url, inPageDeeplinks } = resolveOpenExternalURL(args);

    if (!url || !isSafeURL(url)) {
      Log.warn("Message", `Action deeplink dismissed: URL is empty or unsafe (${url ?? "empty"})`);
      return { kind: "dismiss" };
    }
    return {
      kind: "open_window",
      openWindow: {
        url,
        target: inPageDeeplinks ? "_self" : "_blank",
        features: "noopener",
      },
    };
  };
}

/** Handles `batch.clipboard`. The `t` or `text` arg holds the text to copy. */
export function clipboardAction(copyToClipboard: CopyToClipboardPort): MessageActionHandler {
  return async args => {
    const text = resolveClipboardText(args);
    await copyToClipboard(text);
    return { kind: "dismiss" };
  };
}

/** Handles `batch.group`. The `actions` arg holds `[name, args]` entries, run in order and capped at 10. */
export function groupAction(runner: RenderActionRunner): MessageActionHandler {
  return async (args, context) => {
    const groupedActions = resolveGroupedActions(args);
    let actionableResult: ActionOutcome | null = null;

    for (const groupedAction of groupedActions) {
      if (groupedAction.action.trim().toLowerCase() === "batch.group") {
        Log.warn(ACTION_LOG_MODULE, "batch.group: nested batch.group is not supported, skipping it");
        continue;
      }

      // oxlint-disable-next-line eslint/no-await-in-loop
      const result = await runner.execute(groupedAction, context);
      if (result.kind === "form-feedback") {
        if (result.status !== "success") {
          return result;
        }
        actionableResult = result;
        continue;
      }
      if (actionableResult?.kind === "form-feedback") {
        if (result.kind === "open_window" && !actionableResult.openWindow) {
          actionableResult = { ...actionableResult, openWindow: result.openWindow };
        }
        continue;
      }
      if (actionableResult == null && result.kind !== "dismiss" && result.kind !== "none") {
        actionableResult = result;
      }
    }

    return actionableResult ?? { kind: "none" };
  };
}

/** Handles `batch.user.event`. Args: `e` is the name, `l` the label, `t` the tags, `a` the attributes. */
export function trackEventAction(trackEvent: TrackEventPort): MessageActionHandler {
  return async args => {
    const { eventName, attributes } = resolveTrackEvent(args);
    await trackEvent(eventName, attributes);
    return { kind: "dismiss" };
  };
}

/** Handles `batch.user.tag`. Args: `a` is add or remove, `c` the collection, `t` the tag. */
export function userTagAction(updateUserTag: UpdateUserTagPort): MessageActionHandler {
  return async args => {
    const { action, collection, tag } = resolveUserTag(args);
    await updateUserTag(action, collection, tag);
    return { kind: "dismiss" };
  };
}

/** Handles `batch.request_notifications`. Args: `f` or `force`, and `c` or `component`. */
export function requestNotificationsAction(showUIComponent: ShowUIComponentPort): MessageActionHandler {
  return async args => {
    const force = resolveRequestNotifications(args);
    const component = resolveRequestNotificationsComponent(args);
    await showUIComponent(component, force);
    return { kind: "dismiss" };
  };
}

/** Handles `batch.form.submit` in the SDK host: tracks the event declared in the payload. */
export function formSubmitTrackEventAction(trackEvent: TrackEventPort): MessageActionHandler {
  return async args => {
    const eventName = asString(args[FORM_SUBMIT_EVENT_NAME_KEY]);
    if (!eventName) {
      Log.info(ACTION_LOG_MODULE, `[form] submit action without an event name ("${FORM_SUBMIT_EVENT_NAME_KEY}"), skipping event tracking`);
      return { kind: "form-feedback", status: "success" };
    }
    const attributes = resolveEventAttributes(args[FORM_SUBMIT_ATTRIBUTES_KEY]);
    Log.info(ACTION_LOG_MODULE, `[form] submitted, tracking event "${eventName}" with attributes: ${JSON.stringify(attributes)}`);
    await trackEvent(eventName, attributes);
    return { kind: "form-feedback", status: "success" };
  };
}
