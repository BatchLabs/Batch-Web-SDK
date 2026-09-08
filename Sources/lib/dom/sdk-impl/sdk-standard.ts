import { compareUint8Array } from "com.batch.shared/helpers/array-compare";
import { urlBase64ToUint8Array } from "com.batch.shared/helpers/push-helper";
import { Timeout } from "com.batch.shared/helpers/timed-promise";
import { Log } from "com.batch.shared/logger";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

import { ISDK } from "./sdk";
import BaseSDK, { PUSH_MESSAGING_DISABLED } from "./sdk-base";

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
  // Shared promise used to coalesce concurrent subscribe() calls (see subscribe()).
  private inFlightSubscribe?: Promise<boolean>;

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

    // Push disabled: skip service worker / VAPID setup, no `vapidPublicKey` needed.
    if (!this.pushEnabled) {
      Log.debug(logModuleName, "Push module disabled: skipping service worker and VAPID setup.");
      return this;
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
    return this.pushEnabled && "PushManager" in window;
  }

  //#region Public API

  public async refreshServiceWorkerRegistration(): Promise<void> {
    // No worker is registered when push is disabled; keep refresh a no-op too.
    if (!this.pushEnabled) {
      return Promise.resolve();
    }
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

    return this.subscriptionMatchesCurrentKey(subscription);
  }

  // True if the existing subscription's key matches Batch's; a missing key counts as a match.
  private subscriptionMatchesCurrentKey(subscription: PushSubscription): boolean {
    if (!this.pubKey) {
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
    if (!this.pushEnabled) {
      return Promise.reject(PUSH_MESSAGING_DISABLED);
    }
    // Coalesce concurrent calls so a duplicated caller can't mint two endpoints for one install.
    const inFlight = this.inFlightSubscribe;
    if (inFlight) {
      Log.info(logModuleName, "subscribe() already in progress, reusing the in-flight call");
      return inFlight;
    }
    const subscribePromise = this.doSubscribe();
    this.inFlightSubscribe = subscribePromise;
    try {
      return await subscribePromise;
    } finally {
      this.inFlightSubscribe = undefined;
    }
  }

  private async doSubscribe(): Promise<boolean> {
    const pm = await this.getPushManager();
    let sub: PushSubscription | null;
    try {
      sub = await pm.getSubscription();
      // A stale subscription (different key, e.g. after a VAPID rotation) isn't replaced by subscribe(): drop it first.
      if (sub && !this.subscriptionMatchesCurrentKey(sub)) {
        await sub.unsubscribe();
        sub = null;
      }
      // Reuse a matching subscription, otherwise mint a new one (options also mirrored in worker.ts).
      if (!sub) {
        sub = await pm.subscribe({
          applicationServerKey: this.pubKey as BufferSource,
          userVisibleOnly: true,
        });
      }
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
    if (!this.pushEnabled) {
      return Promise.reject(PUSH_MESSAGING_DISABLED);
    }
    const pm = await this.getPushManager();
    let sub: PushSubscription | null;
    try {
      sub = await pm.getSubscription();
    } catch (e) {
      Log.warn(logModuleName, "unsubscription failed", e);
      sub = null;
    }

    await this.updateSubscription(sub ? sub.toJSON() : null);
    return super.unsubscribe();
  }

  /**
   * In the order :
   * - check the notification permission (no authorisation => no permission)
   * - get the subscription
   *
   */
  public async getSubscription(): Promise<unknown> {
    if (!this.pushEnabled) {
      return Promise.reject(PUSH_MESSAGING_DISABLED);
    }
    if (window?.Notification?.permission !== "granted") {
      // use the subscription in database
      return super.getSubscription();
    }

    // then check we have a subscription
    // and update the parent

    try {
      const pushManager = await this.getPushManager();
      const sub = await pushManager.getSubscription();
      return await this.updateSubscription(sub ? sub.toJSON() : null);
    } catch (e) {
      Log.warn(logModuleName, "get subscription failed, reading it from the database. error:", e);
      return super.getSubscription();
    }
  }
}

//#endregion
