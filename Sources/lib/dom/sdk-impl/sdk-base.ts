import Event from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import EventTracker from "com.batch.shared/event/event-tracker";
import { PublicEvent } from "com.batch.shared/event/public-event";
import { asBoolean } from "com.batch.shared/helpers/primitive";
import { Browser, UserAgent } from "com.batch.shared/helpers/user-agent";
import UUID from "com.batch.shared/helpers/uuid";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";
import { ProbationManager } from "com.batch.shared/managers/probation-manager";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { UserDataPersistence } from "com.batch.shared/persistence/user-data";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";
import { EventData } from "com.batch.shared/user/event-data";
import { UserAttributeEditor } from "com.batch.shared/user/user-attribute-editor";
import { UserModule } from "com.batch.shared/user/user-module";
import { default as WebserviceExecutor, IWebserviceExecutor } from "com.batch.shared/webservice/executor";
import { BatchSDK } from "public/types/public-api";

import { ISDK, ISubscriptionState, Permission } from "./sdk";

const logModuleName = "sdk-base";

/**
 * SDK working with a database only
 */
export default abstract class BaseSDK implements ISDK {
  public config: IPrivateBatchSDKConfiguration;

  protected database: unknown;
  protected eventTracker?: EventTracker;
  protected webserviceExecutor?: IWebserviceExecutor;
  protected parameterStore: ParameterStore;
  protected probationManager: ProbationManager;
  protected userModule?: UserModule;

  /**
   * Keep the last subscription and subscribe state
   * to generate event on change
   */
  protected lastSubscription: unknown;
  protected lastSubscribed: boolean | null;
  protected lastPermission?: Permission;
  protected lastState?: ISubscriptionState;

  public constructor() {
    LocalEventBus.subscribe(LocalSDKEvent.ExitedProbation, this.onProbationChanged.bind(this));
    LocalEventBus.subscribe(LocalSDKEvent.DataChanged, this.onDataChanged.bind(this));
  }

  // ----------------------------------->

  private onProbationChanged(): void {
    Log.info(logModuleName, "Probation changed : " + InternalSDKEvent.FirstSubscription + " sent");
    this.eventTracker?.track(new Event(InternalSDKEvent.FirstSubscription));
  }

  private onDataChanged(): void {
    Log.info(logModuleName, "Data changed : " + InternalSDKEvent.InstallDataChanged + " sent");
    this.eventTracker?.track(new Event(InternalSDKEvent.InstallDataChanged));
  }

  /**
   * Setup the base sdk :
   * - open database
   * - init the webservice
   */
  public async setup(sdkConfig: IPrivateBatchSDKConfiguration): Promise<ISDK> {
    try {
      this.config = Object.assign({}, sdkConfig);
      // TODO Typeof string?
      if (!this.config.apiKey) {
        // TODO check APIKey
        throw new Error("Configuration error: 'apiKey' is mandatory");
      }

      // It isn't in dev, but force it anyway.
      if (!this.config.authKey) {
        throw new Error("Configuration error: 'authKey' is mandatory");
      }

      this.config.dev = asBoolean(this.config.dev, false);

      /**
       * Init the parameter store
       */
      const parameterStore = await ParameterStore.getInstance();
      this.parameterStore = parameterStore;

      /**
       * Save the last known Configuration
       */
      parameterStore.setParameterValue(keysByProvider.profile.LastConfiguration, this.config);

      /**
       * Init installation id
       */

      try {
        const installationID = await parameterStore.getParameterValue(keysByProvider.profile.InstallationID);
        if (installationID == null) {
          this.createInstallationID();
        }
      } catch (e) {
        this.createInstallationID();
      }

      /**
       * Init webservices
       */

      let referrer: string | undefined;
      if (this.config.internal && this.config.internal.referrer) {
        referrer = this.config.internal.referrer;
      }

      this.webserviceExecutor = new WebserviceExecutor(this.config.apiKey, this.config.authKey, this.config.dev, referrer, parameterStore);
      this.probationManager = new ProbationManager(parameterStore);
      this.eventTracker = new EventTracker(this.config.dev, this.webserviceExecutor);
      this.userModule = new UserModule(this.probationManager, await UserDataPersistence.getInstance(), this.webserviceExecutor);

      /**
       * Listen to permission change is available
       */

      // we need to be sure the store, ws, and default values are ready for this one
      // and we don't need to wait for it at the end
      // Safari not supported Permission API
      if (new UserAgent(window.navigator.userAgent).browser !== Browser.Safari) {
        try {
          if (window !== null && typeof window.navigator !== "undefined" && "permissions" in window.navigator) {
            // As of writing only Firefox has this, so don't add that in the .d.ts patches
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const permissions = await (window.navigator as any).permissions.query({ name: "notifications" });
            permissions.addEventListener("change", this.checkUpdate.bind(this));
          } else {
            Log.warn(logModuleName, "Cannot listen to permission changes: API unavailable");
          }
        } catch (e) {
          Log.warn(logModuleName, "Error while listening to permission changes (not a fatal error)", e);
        }
      }

      /**
       * Check update on focus
       * and with an interval
       */

      if (window != null) {
        if (new UserAgent(window.navigator.userAgent).browser === Browser.Firefox) {
          window.setInterval(this.checkUpdate.bind(this), 5000); // Workaround a FF bug
        }
        window.addEventListener("focus", this.checkUpdate.bind(this));

        // Handle special features that are triggered with special hashes
      }

      return this;
    } catch (e) {
      Log.error(logModuleName, "Error while initializing the sdk", e);
      throw new Error("Error while initializing the sdk");
    }
  }

  public async start(): Promise<void> {
    /**
     * Keep the last values of subscription and subscribe flag
     * to generate browser event on change
     */

    const stPromise = this.parameterStore
      .getParameterValue<PushSubscriptionJSON>(keysByProvider.profile.Subscription)
      .then(s => (this.lastSubscription = s));
    const sdPromise = this.parameterStore
      .getParameterValue<boolean>(keysByProvider.profile.Subscribed)
      .then(s => (this.lastSubscribed = s === true));

    this.lastSubscription = this.sanitizeSubscription(this.lastSubscription);

    await Promise.all([stPromise, sdPromise]);
    this.lastPermission = await this.readPermission();
    this.lastState = {
      permission: this.lastPermission || Permission.Default,
      subscribed: this.lastSubscribed || false,
    };

    /**
     * Track the start event
     * wait for the event Tracker, new Session,
     * and default params (we're gonna use the last subscription)
     */
    await this.startSessionIfNeeded();
  }

  // Clear the current session
  public async clearSession(): Promise<void> {
    const store = await this.getParameterStore();
    await store.removeParameterValue(keysByProvider.session.SessionID);
  }

  /**
   * Start a new session if none was in progress
   * resolves to true if a new session was started
   */
  public async startSessionIfNeeded(): Promise<boolean> {
    const store = await this.getParameterStore();
    const sessionId = await store.getParameterValue(keysByProvider.session.SessionID);

    if (sessionId === null) {
      const sessionID = UUID();
      await store.setParameterValue(keysByProvider.session.SessionID, sessionID);
      Log.info(logModuleName, "New session : " + InternalSDKEvent.Start + " sent", "with sub", this.lastSubscription);
      this.eventTracker?.track(new Event(InternalSDKEvent.Start, { token: this.getTokenForEventParameter() }));
      LocalEventBus.emit(LocalSDKEvent.SessionStarted, { sessionID }, true);
      return true;
    }
    return false;
  }

  protected getParameterStore(): Promise<ParameterStore> {
    return this.parameterStore != null ? Promise.resolve(this.parameterStore) : Promise.reject("parameter store null");
  }

  protected async createInstallationID(): Promise<string> {
    // Clear the session storage flag that inhibits the start if we just created the installation id

    const parameterStore = await this.getParameterStore();
    return await parameterStore.setParameterValue(keysByProvider.profile.InstallationID, UUID());
  }

  protected async bumpProfileVersion(): Promise<boolean> {
    const parameterStore = await this.getParameterStore();
    const version = await parameterStore.getParameterValue<string>(keysByProvider.profile.UserProfileVersion);
    const intVal = version == null ? NaN : parseInt(version, 10);
    await parameterStore.setParameterValue(keysByProvider.profile.UserProfileVersion, isNaN(intVal) ? 0 : intVal + 1);
    return true;
  }

  public async setProfileParameter(key: string, identifier?: string | null): Promise<string | null> {
    const definedIdentifier = typeof identifier === "undefined" ? null : identifier;
    const parameterStore = await this.getParameterStore();
    const idChanged = await parameterStore.setOrRemoveParameterValueIfChanged(key, definedIdentifier);
    if (idChanged) {
      this.bumpProfileVersion().then(() => {
        // send SDK event
        if (this.eventTracker) {
          this.eventTracker.track(new Event(InternalSDKEvent.ProfileChanged));
        }
        // send local event
        LocalEventBus.emit(LocalSDKEvent.ProfileChanged, { [key]: definedIdentifier }, true);
      });
    }
    return definedIdentifier;
  }

  //#region Public API

  public abstract refreshServiceWorkerRegistration(): Promise<void>;

  public async setCustomUserID(identifier: string | null | undefined): Promise<string | null> {
    await this.setProfileParameter(keysByProvider.profile.CustomIdentifier, identifier);
    return typeof identifier === "undefined" ? null : identifier;
  }

  public setLanguage(lang: string | null | undefined): Promise<string | null> {
    return this.setProfileParameter(keysByProvider.profile.UserLanguage, lang);
  }

  public setRegion(lang: string | null | undefined): Promise<string | null> {
    return this.setProfileParameter(keysByProvider.profile.UserRegion, lang);
  }

  public async getCustomUserID(): Promise<string | null> {
    const p = await this.getParameterStore();
    return await p.getParameterValue<string>(keysByProvider.profile.CustomIdentifier);
  }

  public async getLanguage(): Promise<string | null> {
    const p = await this.getParameterStore();
    return await p.getParameterValue(keysByProvider.profile.UserLanguage);
  }

  public async getRegion(): Promise<string | null> {
    const p = await this.getParameterStore();
    return await p.getParameterValue(keysByProvider.profile.UserRegion);
  }

  public async getInstallationID(): Promise<string> {
    const parameterStore = await this.getParameterStore();
    const installID = await parameterStore.getParameterValue<string>(keysByProvider.profile.InstallationID);
    if (installID != null) {
      return installID;
    }
    throw new Error("Invalid internal state");
  }

  /**
   * We should have :
   * - the permission granted
   * - the subscribed flag
   * - a subscription
   */
  public async isSubscribed(): Promise<boolean> {
    const permission = await this.getPermission();
    if (permission !== "granted" || !(await this.readAndCheckSubscribed())) {
      return false;
    }
    return this.getSubscription().then(sub => sub != null);
  }

  /**
   * Read the permission and check for diff.
   * Subclasses should not override this method but the readPermission instead.
   */
  public async getPermission(): Promise<Permission> {
    const perm = await this.readPermission();
    return await this.updatePermission(perm);
  }

  /**
   * Read the system notification permission.
   *
   * Note: this cannot be done during setup() on Safari as it needs the websitePushID to be loaded.
   * Delay any call requiring this to after start().
   */
  public readPermission(): Promise<Permission> {
    if (window != null && window.Notification != null) {
      return Promise.resolve(window.Notification.permission as Permission);
    }
    return Promise.reject("Internal error (no window available)");
  }

  /**
   * Subscribe if we have the token in database, use it
   */
  public async subscribe(): Promise<boolean> {
    const perm = await this.getPermission();
    if (perm === "granted") {
      this.updateSubscribed(true);
      return this.isSubscribed();
    }
    throw new Error("Permission denied");
  }

  /**
   * We keep the subscription but change the subscribed flag
   */
  public async unsubscribe(): Promise<boolean> {
    await this.updateSubscribed(false);
    return !(await this.isSubscribed());
  }

  /**
   * Get the subscription from database and check if have changed.
   * Subclasses have to update the description in database (#updateSubscription)
   * in order to emit appropriate events.
   *
   * @return Promise<any>
   */
  public getSubscription(): Promise<unknown | null | undefined> {
    return this.readAndCheckSubscription();
  }

  /**
   * Returned the subscription state based on the subscribed flag and permissions
   */
  public async getSubscriptionState(): Promise<ISubscriptionState> {
    return {
      permission: await this.getPermission(),
      subscribed: await this.isSubscribed(),
    };
  }

  public abstract doesExistingSubscriptionKeyMatchCurrent(): Promise<boolean>;

  public async trackEvent(name: string, eventDataParams?: BatchSDK.EventDataParams): Promise<void> {
    try {
      const eventData = new EventData(eventDataParams);
      this.eventTracker?.track(new PublicEvent(name, await this.probationManager.isInProbation(), eventData));
    } catch (e) {
      Log.error(logModuleName, e);
      return;
    }

    return;
  }

  public async editUserData(callback: (editor: BatchSDK.IUserDataEditor) => void): Promise<void> {
    if (typeof callback !== "function") {
      return;
    }

    if (!this.userModule) {
      Log.error(logModuleName, "Internal error (no user module available)");
      return;
    }

    const editor = new UserAttributeEditor();

    callback(editor);
    editor._markAsUnusable();

    try {
      this.userModule.editUserData(editor);
    } catch (e) {
      Log.error(logModuleName, e);
    }

    return;
  }

  public async getUserAttributes(): Promise<{ [key: string]: BatchSDK.IUserAttribute }> {
    if (this.userModule) {
      return this.userModule.getPublicAttributes();
    }
    throw new Error("Internal error (no user module available)");
  }

  public async getUserTagCollections(): Promise<{ [key: string]: string[] }> {
    if (this.userModule) {
      return this.userModule.getPublicTagCollections();
    }
    throw new Error("Internal error (no user module available)");
  }

  //#endregion

  /**
   * Check if one of the permission, subscription of subscribed changed
   */
  public async checkUpdate(): Promise<void> {
    await this.getSubscriptionState();
    return;
  }

  /**
   * Checks whether the subscription matches the expected format and if not, sanitizes it.
   * Can return undefined if the subscription is inconsistent with the environment (ex: APNS subscription in a WPP environment).
   *
   * Should be overriden by implementations.
   */
  protected sanitizeSubscription(subscription: unknown): unknown {
    return subscription;
  }

  /**
   * Read the subcribed flag and check if something changed
   */
  public async readAndCheckSubscribed(): Promise<boolean> {
    let sub = await (await this.getParameterStore()).getParameterValue<boolean>(keysByProvider.profile.Subscribed);
    sub = sub === true; // Sanitize
    const last = this.lastSubscribed;
    // check if the subscription changed
    if (last !== sub) {
      Log.info(logModuleName, "Subscribed updated from " + last + " to " + sub);
      this.lastSubscribed = sub;
      this.subscriptionChanged(true);
    }
    return sub;
  }

  /**
   * Read the subscription in database and check if something changed
   */
  public async readAndCheckSubscription(): Promise<unknown> {
    let currentSubscription = await (await this.getParameterStore()).getParameterValue<unknown>(keysByProvider.profile.Subscription);
    currentSubscription = this.sanitizeSubscription(currentSubscription);
    const lastSubscription = this.lastSubscription;

    if (this.hasSubscriptionChanged(currentSubscription, lastSubscription)) {
      Log.info(logModuleName, "Subscription updated", currentSubscription);
      this.lastSubscription = currentSubscription;
      this.subscriptionChanged(true);
    }

    return currentSubscription;
  }

  // check if the subscription changed
  protected hasSubscriptionChanged = (current: unknown, last: unknown): boolean => {
    if (current === last) return false;
    if (current == null || last == null) return true;
    if (current === typeof Object && last === typeof Object) {
      if ((current as PushSubscriptionJSON)?.endpoint != (last as PushSubscriptionJSON)?.endpoint) return true;
    }
    return false;
  };

  /**
   * Update the subscribed flag
   * and return the new subscribed state
   */
  public async updateSubscribed(subscribed: boolean): Promise<boolean> {
    const parameterStore = await this.getParameterStore();
    parameterStore.setParameterValue(keysByProvider.profile.Subscribed, subscribed);
    Log.debug(logModuleName, "Writring subscribed:", subscribed);
    return this.readAndCheckSubscribed();
  }

  /**
   * Update the subscription, and return the updated object
   *
   * Subscribed can be updated in the same API call to avoid sending multiple sync events
   */
  public async updateSubscription(sub: unknown | null | undefined, subscribed?: boolean): Promise<unknown | null | undefined> {
    const parameterStore = await this.getParameterStore();
    if (typeof sub === "undefined" || sub == null) {
      await parameterStore.removeParameterValue(keysByProvider.profile.Subscription);
    } else {
      await parameterStore.setParameterValue(keysByProvider.profile.Subscription, sub);
    }

    if (typeof subscribed === "boolean") {
      parameterStore.setParameterValue(keysByProvider.profile.Subscribed, subscribed);
      Log.debug(logModuleName, "Writring subscribed:", subscribed);
    }

    return this.readAndCheckSubscription();
  }

  /**
   * Update the last value of the permission
   */
  public async updatePermission(perm: Permission): Promise<Permission> {
    // check if the subscription changed
    const last = this.lastPermission;
    if (last !== perm) {
      this.lastPermission = perm;
      this.subscriptionChanged(false);
    }
    return perm;
  }

  /**
   * Emit an event
   */
  public async subscriptionChanged(tokenChanged = false): Promise<void> {
    const state = await this.getSubscriptionState();
    // track sdk event
    if (tokenChanged || !this.lastState || this.lastState.subscribed !== state.subscribed) {
      if (this.eventTracker) {
        const params: { [key: string]: unknown } = { token: this.getTokenForEventParameter() };
        if (this.config.internal && this.config.internal.referrer) {
          params.referrer = this.config.internal.referrer;
        }
        this.eventTracker.track(new Event(state.subscribed ? InternalSDKEvent.Subscribed : InternalSDKEvent.Unsubscribed, params));

        // If we sent this, it means that we may have detected a change in "subscribed": save it to ensure consistency
        const p = await this.getParameterStore();
        await p.setParameterValue(keysByProvider.profile.Subscribed, state.subscribed);
      }
    }

    // update the last state
    this.lastState = state;
    // emit a local change
    LocalEventBus.emit(LocalSDKEvent.SubscriptionChanged, state, true);
  }

  /**
   * Create the token from the last subscription
   */
  public getTokenForEventParameter(): object | null {
    if (this.lastSubscription) {
      return { protocol: "WPP", subscription: this.lastSubscription };
    }
    return null;
  }
}
