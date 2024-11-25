import { SAFARI_WS_URL } from "com.batch.shared/../../config";
import { Log } from "com.batch.shared/logger";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

import { ISDK, Permission } from "./sdk";
import BaseSDK from "./sdk-base";
import { ISDKFactory } from "./sdk-factory";

const logModuleName = "sdk-safari";
import { Timeout } from "com.batch.shared/helpers/timed-promise";

import type { SafariPermissionResult } from "./types/window-safari";

type ResponseDiagnostic = {
  status?: "OK" | "FAIL";
  error?: string;
};

const PERMISSION_CALLBACK_WORKAROUND_INTERVAL = 500; // ms
const PERMISSION_CALLBACK_WORKAROUND_ATTEMPTS = 80; // About 40 seconds with a 500ms interval

/**
 * SDK Meant to be used on HTTPS websites
 */
export class SafariSDK extends BaseSDK implements ISDK {
  protected installID: string;
  protected websitePushID?: string;

  // ----------------------------------->

  /**
   * Setup the Safari sdk :
   */
  public async setup(sdkConfig: IPrivateBatchSDKConfiguration): Promise<ISDK> {
    await super.setup(sdkConfig);

    if (window == null) {
      throw new Error("Not in a browser page. is it a service worker?");
    }

    try {
      if (sdkConfig.safari === undefined) {
        throw new Error("Missing safari configuration");
      }

      const configWebsitePushID = sdkConfig.safari[this.getAllowedDomain(sdkConfig.safari)];
      if (typeof configWebsitePushID === "string" && configWebsitePushID.length >= 0) {
        this.websitePushID = configWebsitePushID;
      } else {
        throw new Error("No valid website push ID for current host in safari configuration");
      }

      try {
        this.installID = await this.getInstallationID();
      } catch (e) {
        throw new Error("Could not get installID");
      }
    } catch (e) {
      //FIXME (arnaud): If a Safari-specific setup error occurs,
      // simulate the v2 behaviour (which is incorrect but we keep for an easier migration).
      // That behaviour is:
      //  - Send a _START to the server
      //  - Immediatly die (preventing the public api (setCustomID, language, etc.) from being called)
      // We will (or at least should) rework this in v3
      await this.startSessionIfNeeded();
      throw e;
    }

    return this;
  }

  public async start(): Promise<void> {
    await super.start();

    // Try to resubscribe if we have a valid website push ID
    if (this.isPushMessagingAvailable()) {
      Log.debug(logModuleName, "Tyring to resubscribe for " + this.websitePushID);
      if (this.websitePushID) {
        const remotePermission = window.safari.pushNotification.permission(this.websitePushID);
        try {
          await this.syncSubscription(remotePermission);
        } catch {
          throw new Error("Could not synchronize subscription status with remote");
        }
      }
    }
  }

  //#region Public API

  public async refreshServiceWorkerRegistration(): Promise<void> {
    // No-op on Safari as we don't use a service worker
    return;
  }

  public async doesExistingSubscriptionKeyMatchCurrent(): Promise<boolean> {
    // Safari doesn't use standard notifications: return true.
    return true;
  }

  //#endregion

  // ----------------------------------->

  protected sanitizeSubscription(subscription: unknown): unknown {
    if (typeof subscription === "string" || subscription instanceof String) {
      return subscription;
    }
    Log.debug(logModuleName, "Invalid subscription, sanitizing. (", subscription + ")");
    return;
  }

  // Synchronizes Safari's remote subscription status with the SDK
  // - Tell the server to unsub if the user removed permission
  // - Handle migration from another provider or loss of local data by automatically resubscribing
  //   if the permission is already granted
  private syncSubscription = async (remotePermission: SafariPermissionResult): Promise<boolean> => {
    if (remotePermission.permission === Permission.Denied) {
      const isSubscribed = await this.isSubscribed();
      if (isSubscribed) {
        return this.unsubscribe();
      }
    }

    if (remotePermission.permission === Permission.Granted) {
      const subscription = await this.getSubscription();
      if (!subscription || subscription !== remotePermission.deviceToken) {
        const newSubscription = remotePermission.deviceToken;
        if (newSubscription) {
          await this.updateSubscription(newSubscription, true);
        }
        return this.isSubscribed();
      }
    }
    return Promise.resolve(false);
  };

  private getAllowedDomain = (safari: { [key: string]: string }): string => {
    const origin = window.location.origin.toString().toLowerCase();
    const allowedDomains = Object.keys(safari);
    const allowedDomain = allowedDomains.find(allowedDomain => origin === allowedDomain);
    if (!allowedDomain) {
      throw new Error(`Current website ${origin} is not present in the 'safari' configuration object`);
    }
    return allowedDomain;
  };

  private fetchDiagnostics = async (): Promise<ResponseDiagnostic> => {
    const response = await fetch(`${SAFARI_WS_URL}/${this.config.apiKey}/1.0/diagnostics/${this.websitePushID}`, {
      method: "POST",
      body: JSON.stringify({ installId: this.installID }),
    });
    return await response.json();
  };

  private printDiagnostics = async (): Promise<void> => {
    try {
      const response: void | ResponseDiagnostic = await Promise.race([this.fetchDiagnostics(), Timeout(10000)]);
      if (!response) throw new Error("Invalid diagnostics server response");
      if (response.status === "FAIL") return Log.publicError("[Diagnostics] " + (response?.error ?? "Unknown server error"));
      if (response.status === "OK") return Log.info(logModuleName, "User has denied permission");
    } catch (err) {
      Log.publicError("[Diagnostics] Cannot diagnose registration issue: Internal server error");
      Log.error(logModuleName, "Source error: " + err);
    }
  };

  private requestSafariPermission = async (): Promise<string | null> => {
    if ("safari" in window && "pushNotification" in window.safari && this.websitePushID) {
      const websitePushID = this.websitePushID;
      const currentPermission = window.safari.pushNotification.permission(websitePushID);
      if (currentPermission.permission !== Permission.Default) {
        return this.getSubscriptionTokenAndPrintStatus(currentPermission);
      }

      // See waitUntilUserRepliedToPermissionPrompt's implementation for more info
      const callbackWorkaround = this.waitUntilUserRepliedToPermissionPrompt(websitePushID);

      Log.debug(logModuleName, "Requesting safari permission");
      const safariCallbackPromise = new Promise<string | null>(resolve => {
        window.safari.pushNotification.requestPermission(
          `${SAFARI_WS_URL}/${this.config.apiKey}`,
          websitePushID,
          { installID: this.installID },
          permission => {
            callbackWorkaround.cancel();
            Log.debug(logModuleName, "Got safari permission callback: ", JSON.stringify(permission));
            resolve(this.getSubscriptionTokenAndPrintStatus(permission));
          }
        );
      });

      return Promise.race([safariCallbackPromise, callbackWorkaround.promise]);
    } else {
      return null;
    }
  };

  // Return a promise that resolves once the user has granted or denied the push permission
  // by using a pull-based approach.
  private waitUntilUserRepliedToPermissionPrompt = (websitePushID: string): { cancel: () => void; promise: Promise<string | null> } => {
    let shouldCancel = false;
    const cancel = (): void => {
      shouldCancel = true;
    };
    const promise: Promise<string | null> = new Promise(resolve => {
      // Safari sometimes doesn't call us back on requestPermission, ever.
      // We work around this by starting a background timer that will check for the
      // permission as that API works as expected. We won't wait forever either.
      // See sc-44046 & sc-32581
      let permissionAttemptsLeft = PERMISSION_CALLBACK_WORKAROUND_ATTEMPTS;
      const handle = setInterval(() => {
        if (shouldCancel || permissionAttemptsLeft <= 0) {
          // Do not resolve nor reject the Promise as it will end a race sooner than it should be.
          clearInterval(handle);
          return;
        }
        permissionAttemptsLeft--;
        const permission = window.safari.pushNotification.permission(websitePushID);
        if (permission.permission !== Permission.Default) {
          Log.debug(logModuleName, "Got safari permission using pull: ", JSON.stringify(permission));
          clearInterval(handle);
          resolve(this.getSubscriptionTokenAndPrintStatus(permission));
        }
      }, PERMISSION_CALLBACK_WORKAROUND_INTERVAL);
    });

    return {
      cancel,
      promise,
    };
  };

  private getSubscriptionTokenAndPrintStatus = (cachedPermission?: SafariPermissionResult): string | null => {
    if ("safari" in window && "pushNotification" in window.safari && this.websitePushID) {
      const { permission, deviceToken } = cachedPermission
        ? cachedPermission
        : window.safari.pushNotification.permission(this.websitePushID);
      Log.debug(
        logModuleName,
        "getSubscriptionTokenAndPrintStatus: permission",
        permission,
        "deviceToken",
        deviceToken,
        "NotifPermission",
        window.Notification.permission
      );
      if (permission === Permission.Default) {
        return null;
      } else if (permission === Permission.Denied && window.Notification.permission === Permission.Denied) {
        Log.info(logModuleName, "User denied permission");
        return null;
      } else if (permission == Permission.Denied && window.Notification.permission !== Permission.Denied) {
        Log.info(logModuleName, "Unknown state: requesting diagnostics");
        void this.printDiagnostics();
        return null;
      } else if (permission === Permission.Granted) {
        Log.info(logModuleName, "User granted permission");
        return deviceToken ?? null;
      }
    }
    Log.public(logModuleName, "Safari push notifications are not supported in this environment");
    return null;
  };

  // ----------------------------------->

  public getTokenForEventParameter(): object | null {
    if (this.lastSubscription) {
      return {
        protocol: "APNS",
        subscription: {
          deviceToken: this.lastSubscription,
          websitePushId: this.websitePushID,
        },
      };
    }
    return null;
  }

  public async subscribe(): Promise<boolean> {
    const lastSubscription = this.getSubscriptionTokenAndPrintStatus();
    if (!lastSubscription || !this.lastSubscribed) {
      const currentSubscription = await this.requestSafariPermission();
      await this.updateSubscription(currentSubscription, currentSubscription !== null);
      const subscribed = await this.isSubscribed();
      Log.debug(logModuleName, "Reading subscribed:", subscribed);
      return subscribed;
    }
    return Promise.resolve(false);
  }

  /**
   * We can the subscription to update it and call the super
   * We don't unsubscribe the token, keep it for further use
   */
  public async unsubscribe(): Promise<boolean> {
    return super.unsubscribe();
  }

  /**
   * Returns the system permission
   */
  public readPermission(): Promise<Permission> {
    if (window != null && this.websitePushID) {
      return Promise.resolve(window.safari.pushNotification.permission(this.websitePushID).permission);
    }
    return Promise.reject("Internal error (no window or websitePushID available, is the SDK setup finished?)");
  }

  protected isPushMessagingAvailable(): boolean {
    return window != null && "safari" in window && "pushNotification" in window.safari;
  }
}

// ----------------------------------->

/**
 * Factory to provide a unique instance of an Secure sdk
 */
class SafariSDKFactory implements ISDKFactory {
  private instance?: Promise<ISDK> | null;

  public constructor() {
    this.instance = null;
  }

  public setup(config: IPrivateBatchSDKConfiguration): Promise<ISDK> {
    /**
     * Init the instance if first time
     */
    if (this.instance == null) {
      // keep a copy of this config
      // avoid the conf to be modified later
      const sdkConfig = Object.assign({}, config);

      Log.info(logModuleName, "Instantiating a new SDK");
      const sdk: ISDK = new SafariSDK();
      this.instance = sdk.setup(sdkConfig).then(() => sdk);
    } else {
      // just show a warn
      Log.warn(logModuleName, "Config cannot be set again once the SDK has already been started");
    }

    return this.instance || Promise.reject("Setup failed");
  }

  public getInstance(): Promise<ISDK> {
    return this.instance || Promise.reject("You must setup the SDK before using it");
  }
}

/**
 * Export a singleton of this factory
 */
export default new SafariSDKFactory();
