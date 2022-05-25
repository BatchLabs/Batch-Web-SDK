import { SAFARI_WS_URL } from "com.batch.shared/../../config";
import { Log } from "com.batch.shared/logger";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

import { ISDK, ISDKFactory, Permission } from "./sdk";
import BaseSDK from "./sdk-base";

const logModuleName = "sdk-safari";
import { Timeout } from "com.batch.shared/helpers/timed-promise";

import type { SafariPermissionResult } from "./types/window-safari";

type ResponseDiagnostic = {
  status?: "OK" | "FAIL";
  error?: string;
};

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
          this.updateSubscription(newSubscription, true);
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
      if (response.status === "FAIL") return Log.publicError("[Diagnostics] " + response?.error ?? "Unknown server error");
      if (response.status === "OK") return Log.info(logModuleName, "User has denied permission");
    } catch (err) {
      Log.publicError("[Diagnostics] Cannot diagnose registration issue: Internal server error");
      Log.error(logModuleName, "Source error: " + err);
    }
  };

  private requestSafariPermission = async (): Promise<string | null> => {
    return new Promise(resolve => {
      if ("safari" in window && "pushNotification" in window.safari && this.websitePushID) {
        Log.debug(logModuleName, "Requesting safari permission");
        window.safari.pushNotification.requestPermission(
          `${SAFARI_WS_URL}/${this.config.apiKey}`,
          this.websitePushID,
          { installID: this.installID },
          permission => {
            Log.debug(logModuleName, "Got safari permission callback: ", JSON.stringify(permission));
            resolve(this.getSubscriptionTokenAndPrintStatus(permission));
          }
        );
      } else {
        resolve(null);
      }
    });
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
        this.printDiagnostics();
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
