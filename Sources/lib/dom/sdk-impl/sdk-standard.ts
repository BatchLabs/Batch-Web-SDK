import { compareUint8Array } from "com.batch.shared/helpers/array-compare";
import { urlBase64ToUint8Array } from "com.batch.shared/helpers/push-helper";
import { Timeout } from "com.batch.shared/helpers/timed-promise";
import { Log } from "com.batch.shared/logger";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

import { ISDK } from "./sdk";
import BaseSDK from "./sdk-base";
import { ISDKFactory } from "./sdk-factory";

const logModuleName = "sdk-standard";
const defaultTimeout = 10; // default service worker timeout in seconds
const defaultServiceWorkerPath = "/batchsdk-worker-loader.js";

/**
 * SDK Meant to be used on HTTPS websites
 */
export class StandardSDK extends BaseSDK implements ISDK {
  protected pubKey?: Uint8Array;
  protected worker: ServiceWorker | null;
  protected pushManager?: PushManager;

  // ----------------------------------->

  /**
   * Setup the Standard sdk :
   * - check for service worker and push managers
   * - install the service worker
   */
  public async setup(sdkConfig: IPrivateBatchSDKConfiguration): Promise<ISDK> {
    await super.setup(sdkConfig);
    if (window == null) {
      throw new Error("not in a browser page. is it a service worker?");
    }

    // check if service worker is supported
    if (!("serviceWorker" in window.navigator)) {
      throw new Error("no service worker");
    }

    if (!sdkConfig.vapidPublicKey) {
      throw new Error("Invalid public key");
    }

    // keep the pub key
    try {
      this.pubKey = urlBase64ToUint8Array(sdkConfig.vapidPublicKey);
    } catch (e) {
      Log.publicError("Could not decode 'vapidPublicKey'. Is it well formatted?");
      throw new Error("Could not decode 'vapidPublicKey'. Is it well formatted?");
    }

    await this.initServiceWorker(sdkConfig);

    return this;
  }

  private async initServiceWorker(sdkConfig: IPrivateBatchSDKConfiguration): Promise<void> {
    const sdkSWConfig = sdkConfig.serviceWorker || {};
    if (window.navigator.serviceWorker != null) {
      const timeout = Math.max(defaultTimeout, sdkSWConfig.waitTimeout || defaultTimeout);

      try {
        const result = await Promise.race([this.registerOrGetServiceWorker(sdkConfig), Timeout(timeout * 1000)]);
        if (result) {
          this.refreshInternalServiceWorkerState(result);
        }
      } catch (e) {
        Log.error(logModuleName, "Error while initializing service worker :", e);
        if (sdkSWConfig.automaticallyRegister) {
          Log.publicError(
            "Failed to register the service worker. Is it accessible at '" + defaultServiceWorkerPath + "'?\nOriginal error: " + e
          );
        } else {
          Log.publicError(
            "Error while waiting for the existing service worker: is your service worker properly registered?\nOriginal error: " + e
          );
        }
        throw new Error("An error occurred while initializing the service worker: " + e);
      }
    } else {
      throw new Error("Browser does not support service workers");
    }
  }

  /**
   * Get the Service Worker registration, by registering it if needed.
   */
  private async registerOrGetServiceWorker(sdkConfig: IPrivateBatchSDKConfiguration): Promise<ServiceWorkerRegistration> {
    const swContainer = window.navigator.serviceWorker;
    const sdkSWConfig = sdkConfig.serviceWorker || {};

    if (sdkSWConfig.automaticallyRegister === false) {
      Log.info(logModuleName, "Not registering Batch's SW, we have been asked to use an existing one");
      // If user asked to use an existing service worker, also await the manual API
      // Look for the registration in "internalTransient": it is NOT in ISDKServiceWorkerConfiguration
      // as it is not serializable.
      if (sdkConfig.internalTransient?.serviceWorkerRegistrationPromise) {
        Log.info(logModuleName, "Awaiting SW Promise");
        return sdkConfig.internalTransient.serviceWorkerRegistrationPromise;
      } else {
        Log.info(logModuleName, "Awaiting SW ready");
        return swContainer.ready;
      }
    } else {
      await swContainer.register(defaultServiceWorkerPath, { scope: "/" });
    }
    const registration = await swContainer.ready;
    Log.info(logModuleName, "service worker ready");
    return registration;
  }

  /**
   * Update the service worker related internal state
   */
  private refreshInternalServiceWorkerState(registration: ServiceWorkerRegistration): void {
    this.worker = registration.active;
    this.pushManager = registration.pushManager;
  }

  // ----------------------------------->
  // Returns non null objects

  public getPushManager(): Promise<PushManager> {
    return this.pushManager != null ? Promise.resolve(this.pushManager) : Promise.reject("push manager is null");
  }

  public getWorker(): Promise<ServiceWorker> {
    return this.worker != null ? Promise.resolve(this.worker) : Promise.reject("worker is null");
  }

  protected sanitizeSubscription(subscription: unknown): unknown {
    if (
      typeof subscription === "object" &&
      subscription !== null &&
      typeof (subscription as PushSubscriptionJSON)["endpoint"] === "string"
    ) {
      return subscription;
    }
    Log.debug(logModuleName, "Invalid subscription, sanitizing. (", subscription + ")");
    return;
  }

  protected isPushMessagingAvailable(): boolean {
    return "PushManager" in window;
  }

  //#region Public API

  public async refreshServiceWorkerRegistration(): Promise<void> {
    this.worker = null;
    this.pushManager = undefined;
    return this.initServiceWorker(this.config);
  }

  public async doesExistingSubscriptionKeyMatchCurrent(): Promise<boolean> {
    // If there is no SW, no registration, no subscription: return true
    // This only returns false if we have an existing key that doesn't match Batch's.
    if (!window.navigator.serviceWorker) {
      return true;
    }

    if (!this.pubKey) {
      return true;
    }

    const registration = await window.navigator.serviceWorker.getRegistration();
    if (!registration) {
      return true;
    }

    const pushManager = registration.pushManager;
    if (!pushManager) {
      return true;
    }

    const subscription = await pushManager.getSubscription();
    if (!subscription) {
      return true;
    }

    const currentKey = subscription.options.applicationServerKey;
    if (!currentKey) {
      return true;
    }

    return compareUint8Array(this.pubKey, new Uint8Array(currentKey));
  }

  /**
   * In this order :
   * - try to subscribe
   * - handle the push manager error
   * - reflect the result to the parent
   *
   * FIXME if we have a database error ????
   */
  public async subscribe(): Promise<boolean> {
    const pm = await this.getPushManager();
    let sub: PushSubscription | null;
    try {
      // Anything changed in subscribe should also be changed in worker.ts
      sub = await pm.subscribe({
        applicationServerKey: this.pubKey,
        userVisibleOnly: true,
      });
    } catch (e) {
      Log.warn(logModuleName, "subscription failed", e);
      sub = null;
    }

    await this.updateSubscription(sub ? sub.toJSON() : null, sub != null);
    const subscribed = await this.isSubscribed();
    return subscribed;
  }

  /**
   * We can the subscription to update it and call the super
   * We don't unsubscribe the token, keep it for further use
   */
  public async unsubscribe(): Promise<boolean> {
    const pm = await this.getPushManager();
    let sub: PushSubscription | null;
    try {
      sub = await pm.getSubscription();
    } catch (e) {
      Log.warn(logModuleName, "unsubscription failed", e);
      sub = null;
    }

    this.updateSubscription(sub ? sub.toJSON() : null);
    return super.unsubscribe();
  }

  /**
   * In the order :
   * - check the notification permission (no authorisation => no permission)
   * - get the subscription
   *
   */
  public async getSubscription(): Promise<unknown | null | undefined> {
    if (window?.Notification?.permission !== "granted") {
      // use the subscription in database
      return super.getSubscription() as Promise<PushSubscriptionJSON>;
    }

    // then check we have a subscription
    // and update the parent

    try {
      const pushManager = await this.getPushManager();
      const sub = await pushManager.getSubscription();
      return this.updateSubscription(sub ? sub.toJSON() : null);
    } catch (e) {
      Log.warn(logModuleName, "get subscription failed, reading it from the database. error:", e);
      return super.getSubscription();
    }
  }
}

//#endregion

/**
 * Factory to provide a unique instance of an Standard sdk
 */
class StandardSDKFactory implements ISDKFactory {
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
      const sdk: ISDK = new StandardSDK();
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
export default new StandardSDKFactory();
