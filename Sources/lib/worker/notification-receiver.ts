// Set a SW context
declare let self: ServiceWorkerGlobalScope;

import { ICONS_URL } from "com.batch.shared/../../config";
import BatchEvent from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import EventTracker from "com.batch.shared/event/event-tracker";
import { Log } from "com.batch.shared/logger";
import { Action, Payload } from "com.batch.shared/notification/payload";
import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

const moduleName = "NotificationReceiver";
const batchActionPrefix = "batch-action::";

export interface INotificationData {
  title: string;
  params: Partial<NotificationOptions>;
}

export default class NotificationReceiver {
  private lastKnownConfiguration: IPrivateBatchSDKConfiguration | undefined | null;
  private isSubscribed: boolean;

  public constructor(lastConfig: object | undefined | null, subscribed: boolean) {
    if (NotificationReceiver.isConfigValid(lastConfig)) {
      if (typeof lastConfig.dev !== "boolean") {
        lastConfig.dev = false;
      }
      this.lastKnownConfiguration = lastConfig;
    } else {
      this.lastKnownConfiguration = null;
    }

    this.isSubscribed = subscribed;
  }

  public static async getInstance(parameterStorePromise: Promise<ParameterStore>): Promise<NotificationReceiver> {
    try {
      const parameterStore = await parameterStorePromise;
      const parameters = await parameterStore.getParametersValues([ProfileKeys.LastConfiguration, ProfileKeys.Subscribed]);
      return new NotificationReceiver(parameters[ProfileKeys.LastConfiguration] as object, parameters[ProfileKeys.Subscribed] as boolean);
    } catch (_) {
      return new NotificationReceiver(null, false);
    }
  }

  private static isConfigValid(config: object | undefined | null): config is IPrivateBatchSDKConfiguration {
    if (config) {
      const { apiKey, authKey } = config as IPrivateBatchSDKConfiguration;
      if (typeof apiKey !== "string" || typeof authKey !== "string") {
        return false;
      }
      return true;
    }
    return false;
  }

  // Public methods
  public static isBatchPushPayload(payload: unknown): boolean {
    if (typeof payload === "object") {
      return Payload.hasEssentialKeys(payload);
    }
    return false;
  }

  private getDefaultIcon(config: IPrivateBatchSDKConfiguration | null | undefined): string {
    if (!config) return "";
    if (typeof config.defaultIcon === "string") return config.defaultIcon;
    return `${ICONS_URL}/${config.apiKey}/default-icon.png`;
  }

  private getSmallIcon(config: IPrivateBatchSDKConfiguration | null | undefined): string {
    if (!config) return "";
    if (typeof config.smallIcon === "string") return config.smallIcon;
    return `${ICONS_URL}/${config.apiKey}/small-icon.png`;
  }

  public getNotificationData(rawPayload: Record<string, unknown>): INotificationData | undefined {
    Log.debug(moduleName, "Raw payload", rawPayload, this.lastKnownConfiguration);
    try {
      const p = new Payload(rawPayload);
      const notificationData = {
        params: {
          actions: p.getActions().map((a, i) => {
            return {
              action: batchActionPrefix + i,
              icon: a.iconURL,
              title: a.label,
            };
          }),
          badge: p.getBadgeImageURL() || this.getSmallIcon(this.lastKnownConfiguration),
          body: p.getBody(),
          data: rawPayload,
          icon: p.getIconURL() || this.getDefaultIcon(this.lastKnownConfiguration),
          image: p.getImageURL(),
          renotify: p.shouldRenotify(),
          requireInteraction: p.requireInteraction() || false,
          silent: p.isSilent(),
          tag: p.getTag(),
        },
        title: p.getTitle(),
      };
      Log.debug(moduleName, "Notification data", notificationData);
      return notificationData;
    } catch (err) {
      Log.error(moduleName, "Error while creating the notification:", err);
      return undefined;
    }
  }

  public handleNotificationClickEvent(ne: NotificationEvent, eventTracker: EventTracker | undefined | null): Promise<void> {
    // Notification is the full notification object
    // Action is the action string of the pressed button, undefined if the user clicked anywhere else
    // such has the notification itself
    let payload: Payload;
    try {
      if (!ne || !ne.notification || !ne.notification.data) {
        throw new Error("NotificationEvent lacks essential information");
      }
      payload = new Payload(ne.notification.data);
    } catch (err) {
      Log.error(moduleName, "Error while handling the notification click event", err);
      return Promise.reject(err);
    }

    const actionString = ne.action;
    Log.debug(moduleName, "Handle notification click event:", actionString, ne.notification);

    // Track the open
    if (eventTracker) {
      eventTracker.track(
        new BatchEvent(InternalSDKEvent.PushOpen, {
          i: payload.getSendID(),
          od: payload.getOpenData(),
        })
      );
    }

    // Handle the action
    let action = null;

    if (actionString) {
      // Chrome only, as of writing.
      // Action is an action string, much like Windows Phone. Check that it stars with batchActionPrefix
      if (actionString.startsWith(batchActionPrefix)) {
        const actionIndex = parseInt(actionString.substring(batchActionPrefix.length), 10);
        if (!isNaN(actionIndex)) {
          // If not found, that will set action to undefined and that's what we want
          action = payload.getActions()[actionIndex];
          // Clean up
          action = action || null;
        }
      }
    }

    if (!action) {
      action = payload.getDefaultAction();
    }

    if (!action) {
      action = new Action();
      action.action = "batch.deeplink";
      action.args = {
        l: "auto",
        newTab: false,
      };
    }

    if (!action) {
      Log.error(moduleName, "Empty action, not doing anything");
      return Promise.reject("Empty action");
    }

    try {
      return this.performAction(action);
    } catch (err) {
      Log.error(moduleName, "Could not execute notification click action", err);
      return Promise.reject(err);
    }
  }

  // Perform the specified action, in the context of a service worker
  public async performAction(action: Action): Promise<void> {
    if (action.action === "batch.deeplink") {
      const deeplink = action.args.l;

      if (typeof deeplink !== "string") {
        throw new Error("Could not open notification: Invalid deeplink type (12)");
      }

      let targetHref = "";
      try {
        targetHref = new URL(deeplink).href; // URL throws on invalid URL so this sanitizes it
      } catch {
        // The legacy "auto" value is not a valid URL, and will trigger this fallback,
        // which was the old intended behaviour
        try {
          if (!this.lastKnownConfiguration || !this.lastKnownConfiguration.internal) {
            throw new Error("No internal config object");
          }
          const origin = this.lastKnownConfiguration.internal.origin;
          if (!origin) {
            throw new Error("No origin in last known configuration");
          }
          targetHref = new URL(origin).href;
        } catch (err) {
          Log.error(moduleName, "No origin to fall back on after a lack of default action", err);
          throw new Error("Could not open notification: Internal/database error (10)");
        }
      }

      if (targetHref) {
        self.clients.openWindow(targetHref);
        return Promise.resolve();
      } else {
        throw new Error("Could not open notification: Internal error (11)");
      }
    }
    throw new Error("Unsupported action " + action.action);
  }
}
