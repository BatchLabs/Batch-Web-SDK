import { BatchSDK } from "public/types/public-api";

export enum Permission {
  Default = "default",
  Granted = "granted",
  Denied = "denied",
}

export interface ISubscriptionState {
  /**
   * Determines whether the user is subscribed
   * @see ISDK#isSubscribed()
   */
  subscribed: boolean;

  /**
   * The notification permission
   * @see ISDK#getPermission()
   */
  permission: Permission;
}

export interface ISDK {
  /**
   * Setup this SDK.
   * In case of inheritance, subclasses have to call the super setup method
   * and chain their setup stuff to the returned promise.
   *
   * The SDK will be considered intialized and usable once the returned promise ends (resolved or rejected).
   */
  setup(config: object): Promise<ISDK>;

  /**
   * Refresh the SW registration
   *
   * See public-api for more info
   */
  refreshServiceWorkerRegistration: () => Promise<void>;

  /**
   * Start the SDK
   *
   * Even though a lot of the start logic is in setup()
   */
  start(): Promise<void>;

  /**
   * Return the custom user id associated to this installation.
   */
  getCustomUserID(): Promise<string | null>;

  /**
   * Associate a new language to this installation.
   */
  setLanguage(language?: string | undefined | null): Promise<string | null>;

  /**
   * Return the language associated to this installation.
   */
  getLanguage(): Promise<string | null>;

  /**
   * Associate a new region to this installation.
   */
  setRegion(region: string | undefined | null): Promise<string | null>;

  /**
   * Return the region associated to this installation.
   */
  getRegion(): Promise<string | null>;

  /**
   * Associate a new custom user id to this installation.
   */
  setCustomUserID(identifier?: string | undefined | null): Promise<string | null>;

  /**
   * Returns the identifier of this installation.
   */
  getInstallationID(): Promise<string>;

  /**
   * Determines whether the user is subscribed and the permission is granted.
   */
  isSubscribed(): Promise<boolean>;

  /**
   * Returns the permission
   * - granted : the user accept the notifications
   * - denied : the user refused
   * - default : we don't know, we have to ask the user
   */
  getPermission(): Promise<Permission>;

  /**
   * Try to subscribe to the push if we aren't already.
   * Return true if the subscription succeed (or was alread subscribed; false otherwise)
   */
  subscribe(): Promise<boolean>;

  /**
   * Try to unsubscribe to the push if we aren't already.
   * Return true if the unsubscription succeed (or wasn't subscribed); false otherwise
   */
  unsubscribe(): Promise<boolean>;

  /**
   * Returns the current subscription associated to this installation.
   * Having a subscription doesn't mean you're subscribed, use the #isSubscribed method for this
   */
  getSubscription(): Promise<unknown | null | undefined>; // FIXME what do we return ?

  /**
   * Returns the subscription state
   */
  getSubscriptionState(): Promise<ISubscriptionState>;

  /**
   * Checks if the current pushManager applicationServerKey match what Batch has been configured with.
   * See public-api.d.ts for more info.
   */
  doesExistingSubscriptionKeyMatchCurrent: () => Promise<boolean>;

  /**
   *
   * Track an event.
   * @param name The event name. Must be a string.
   * @param params The params (optional). Must be an object.
   */
  trackEvent(name: string, params?: BatchSDK.EventDataParams): void;

  editUserData(callback: (editor: BatchSDK.IUserDataEditor) => void): void;

  getUserAttributes(): Promise<{ [key: string]: BatchSDK.IUserAttribute }>;

  getUserTagCollections(): Promise<{ [key: string]: string[] }>;
}
