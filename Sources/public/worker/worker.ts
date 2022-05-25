import BatchEvent from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import EventTracker from "com.batch.shared/event/event-tracker";
import { urlBase64ToUint8Array } from "com.batch.shared/helpers/push-helper";
import { Log, LogLevel } from "com.batch.shared/logger";
import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";
import WebserviceExecutor from "com.batch.shared/webservice/executor";
import StubWebserviceExecutor from "com.batch.shared/webservice/executor-stub";
import NotificationReceiver from "com.batch.worker/notification-receiver";

import { IS_DEV } from "../../config";

declare let self: BatchServiceWorkerGlobalScope;
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
interface BatchServiceWorkerGlobalScope extends ServiceWorkerGlobalScope {
  batchSDK_enable_debug_logging?: boolean;
  handleBatchSDKEvent?: (eventName: string, event: Event) => Promise<void>;
}

Log.name = "ServiceWorker";
if (IS_DEV || self.batchSDK_enable_debug_logging === true) {
  Log.level = LogLevel.Debug;
  Log.enableModule("*");
}

const moduleName = "ServiceWorker";

const broadcast = (message: unknown): void => {
  self.clients.matchAll().then((clients: Client[]) => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
};

const getLastKnownGoodConfiguration = (): Promise<IPrivateBatchSDKConfiguration> => {
  return ParameterStore.getInstance()
    .then(db => db.getParameterValue(ProfileKeys.LastConfiguration))
    .then((config: IPrivateBatchSDKConfiguration) => {
      if (typeof config !== "object") {
        throw new Error("Last config is missing or is not an object");
      }

      // TODO Typeof string?
      if (!config.apiKey) {
        // TODO check APIKey format
        throw new Error("Configuration error: 'apiKey' is mandatory");
      }

      if (!config.subdomain) {
        throw new Error("Configuration error: 'subdomain' is mandatory");
      }

      // Not in dev, but make it mandatory so the dev doesn't forget it
      if (!config.authKey) {
        throw new Error("Configuration error: 'authKey' is mandatory");
      }

      if (typeof config.dev !== "boolean") {
        config.dev = false;
      }

      return config;
    });
};

// This should not be held for long, as it heavily depends on the last configuration
// If not good configuration is available, the event tracker will be returned with a stub executor
// TODO: Find a better method name that shows that this event tracker can use a stub ws executor
const getEventTracker = (): Promise<EventTracker> => {
  return Promise.all([ParameterStore.getInstance(), getLastKnownGoodConfiguration()])
    .then(results => {
      const db = results[0];
      const config = results[1];

      Log.debug(moduleName, "Loaded config", db, config);

      if (!db || typeof config !== "object") {
        // eslint-disable-next-line max-len
        throw new Error(
          "Unexpected error: Invalid promise result. ParameterStore and getLastKnownGoodConfiguration should not be undefined or null"
        );
      }

      let referrer: string | undefined;
      if (config.internal && config.internal.referrer) {
        referrer = config.internal.referrer;
      }

      return new EventTracker(config.dev || false, new WebserviceExecutor(config.apiKey, config.authKey, config.dev, referrer, db));
    })
    .catch(e => {
      // TODO: Fix this eslint disable, can we break the error string?
      // eslint-disable-next-line max-len
      Log.error(
        moduleName,
        "Error while getting the WS executor with the real configuration. Returning an event tracker with a stub executor. Error:",
        e
      );
      return new EventTracker(false, new StubWebserviceExecutor());
    });
};

const pushEventReceived = (event: PushEvent): Promise<void> => {
  return Promise.resolve()
    .then(() => {
      // FIXME should we note the difference between an http and https???
      Log.debug(moduleName, "Got a push event", event);
      let notificationPayload: Record<string, unknown> | null = null;
      try {
        if (!event.data) {
          throw new Error("No event data");
        }
        notificationPayload = event.data.json();
      } catch (err) {
        Log.debug(moduleName, "Notification has no valid JSON payload: not a Batch push");
      }

      if (typeof notificationPayload === "object" && NotificationReceiver.isBatchPushPayload(notificationPayload)) {
        Log.info(moduleName, "Notification event is a Batch push", event);
        return NotificationReceiver.getInstance(ParameterStore.getInstance())
          .then(receiver => {
            if (!receiver.shouldDisplayNotifications()) {
              Log.info(moduleName, "User is not registred", event);
              return Promise.resolve();
            }
            const notificationData = notificationPayload != null ? receiver.getNotificationData(notificationPayload) : null;
            if (notificationData) {
              return self.registration
                .showNotification(notificationData.title, notificationData.params)
                .then(() => {
                  Log.info(moduleName, "Notification displayed", notificationData);
                })
                .catch(err => {
                  Log.error(moduleName, "Error while displaying the notification", err, notificationData);
                });
            }

            Log.error(moduleName, "Failed to generate push notification data");

            return Promise.resolve();
          })
          .catch(err => {
            Log.error(moduleName, "Error while displaying push:", err);
          });
      }

      Log.debug(moduleName, "Notification is not a Batch push");
      return Promise.resolve();
    })
    .catch(err => {
      Log.error(moduleName, "Unexpected error while handling pushEvent", err);
    });
};

const pushSubscriptionChanged = (event: PushSubscriptionChangeEvent): Promise<void> => {
  return Promise.all([ParameterStore.getInstance(), getLastKnownGoodConfiguration()])
    .then(async results => {
      const db = results[0];
      const config = results[1];

      let subOptions: PushSubscriptionOptionsInit | null = null;
      // Can't use event.newSubscription or event.oldSubscription all the time since Firefox OF COURSE doesn't have them
      if (event.oldSubscription && event.oldSubscription.options) {
        subOptions = event.oldSubscription.options;
      } else {
        if (config.vapidPublicKey) {
          const pubKey = urlBase64ToUint8Array(config.vapidPublicKey);
          subOptions = {
            applicationServerKey: pubKey,
            userVisibleOnly: true,
          };
        } else {
          Log.error(moduleName, "No 'vapidPublicKey' found in config");
        }
      }

      if (subOptions) {
        Log.debug(moduleName, "Updating registration");

        const isSubscribed = await db.getParameterValue(ProfileKeys.Subscribed);

        if (isSubscribed) {
          //FIXME: ne marche pas avec Safari
          try {
            const sub = await self.registration.pushManager.subscribe(subOptions);
            if (sub) {
              await db.setParameterValue(ProfileKeys.Subscribed, true);
              await db.setParameterValue(ProfileKeys.Subscription, sub.toJSON());
              const eventTracker = await getEventTracker();

              // eslint-disable-next-line @typescript-eslint/camelcase
              const params: { [key: string]: unknown } = { from_change_event: true, token: { protocol: "WPP", subscription: sub } };
              if (config.internal && config.internal.referrer) {
                params.referrer = config.internal.referrer;
              }

              eventTracker.track(new BatchEvent(InternalSDKEvent.Subscribed, params));
            } else {
              throw new Error("null subscription");
            }
          } catch (err) {
            Log.error(moduleName, "Could not update subscription: ", err);
          }
        } else {
          Log.info(moduleName, "Unable to update the subscription because the user has opt-out");
        }
      }
    })
    .catch(err => {
      Log.error(moduleName, "Could not handle pushsubscriptionchange: ", err);
    });
};

const notificationClickEventReceived = (event: NotificationEvent): Promise<void> => {
  return Promise.resolve()
    .then(() => {
      Log.debug(moduleName, "Got a notification click event", event);

      if (event && event.notification && NotificationReceiver.isBatchPushPayload(event.notification.data)) {
        if (event.notification.close) {
          event.notification.close();
        } else {
          Log.error(moduleName, "Could not close the notification");
        }

        return NotificationReceiver.getInstance(ParameterStore.getInstance())
          .then(receiver => {
            return getEventTracker().then(tracker => {
              return receiver.handleNotificationClickEvent(event, tracker).catch(err => {
                Log.debug(moduleName, "Error while handling notification click event", err);
              });
            });
          })
          .catch(err => {
            Log.error(moduleName, "Error while handling notification click:", err);
          });
      }

      return Promise.resolve();
    })
    .catch(err => {
      Log.error(moduleName, "Unexpected error while handling notificationClickEvent", err);
    });
};

const messageEventReceived = (event: MessageEvent): void => {
  switch (event.data) {
    case "init":
      Log.debug(moduleName, "Batch initialzied");
      break;

    case "start":
      Log.debug(moduleName, "send start");
      break;

    case "pushToken":
      Log.debug(moduleName, "change pushtoken");
      break;

    case "testBroadcast":
      broadcast("broad cast");
      break;

    default:
      Log.debug(moduleName, "unhandled message");
  }
};

self.handleBatchSDKEvent = (eventName: string, event: Event): Promise<void> => {
  switch (eventName) {
    case "pushsubscriptionchange":
      return pushSubscriptionChanged(event as PushSubscriptionChangeEvent);
    case "install":
      self.skipWaiting();
      break;
    case "push":
      return pushEventReceived(event as PushEvent);
    case "notificationclick":
      return notificationClickEventReceived(event as NotificationEvent);
    case "message":
      messageEventReceived(event as MessageEvent);
      break;
    default:
      Log.debug(moduleName, "Got an unhandled event", eventName);
  }
  return Promise.resolve();
};
