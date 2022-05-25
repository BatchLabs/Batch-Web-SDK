// tslint:disable no-namespace
// tslint:disable no-shadowed-variable

import LocalSDKEvent from "com.batch.shared/local-sdk-events";

declare namespace BatchSDK {
  /**
   * Event attribute types.
   *
   * This enum's implementation is available on api.eventAttributeTypes.
   */
  export enum TypedEventAttributeType {
    STRING = "s",
    BOOLEAN = "b",
    INTEGER = "i",
    FLOAT = "f",
    DATE = "t",
    URL = "u",
  }

  /**
   * User attribute types.
   *
   * This enum's implementation is available on api.userAttributeTypes.
   */
  export enum UserAttributeType {
    STRING = "s",
    BOOLEAN = "b",
    INTEGER = "i",
    FLOAT = "f",
    DATE = "t",
    URL = "u",
  }

  export type EventAttributeValue =
    | { type: TypedEventAttributeType.BOOLEAN; value: boolean | number }
    | { type: TypedEventAttributeType.STRING; value: string }
    | { type: TypedEventAttributeType.URL; value: string | URL }
    | { type: TypedEventAttributeType.INTEGER; value: number | `${number}` }
    | { type: TypedEventAttributeType.FLOAT; value: number | `${number}` }
    | { type: TypedEventAttributeType.DATE; value: Date };

  export type EventDataParams = {
    attributes?: {
      [key: string]: EventAttributeValue | string | boolean | number | URL | Date;
    };
    tags?: string[];
    label?: string | null;
  };

  export type UserAttributeValue =
    | { type: UserAttributeType.BOOLEAN; value: boolean | number }
    | { type: UserAttributeType.STRING; value: string }
    | { type: UserAttributeType.URL; value: string | URL }
    | { type: UserAttributeType.INTEGER; value: number | `${number}` }
    | { type: UserAttributeType.FLOAT; value: number | `${number}` }
    | { type: UserAttributeType.DATE; value: Date };

  /**
   * Object representing a user attribute.
   * An attribute is represented by it's type, which maches the one you've used
   * when setting the attribute, and its value.
   *
   * You can get the attribute using the generic getter, or use the typed ones
   * that will cast the value or return undefined if the type doesn't match.
   */
  interface IUserAttribute {
    getType(): UserAttributeType;
    getValue(): unknown;

    getStringValue(): string | undefined;
    getBooleanValue(): boolean | undefined;
    getNumberValue(): number | undefined;
    getDateValue(): Date | undefined;
    getURLValue(): URL | undefined;
  }

  export interface ISDKConfiguration {
    dev: boolean;
    smallIcon?: string;
    defaultIcon?: string;
    subdomain?: string;
    authKey: string;
    apiKey: string;
    vapidPublicKey?: string;
    useExistingServiceWorker?: boolean;
    serviceWorkerPathOverride?: string;
    serviceWorkerTimeout?: number;
    /**
     * @deprecated used by old versions
     * @ignore
     */
    sameOrigin?: boolean;
    safari?: ISafariConfig;
    /**
     * Enable features that are triggered using a hash in the URL. Default: true
     */
    enableHashFeatures?: boolean;
    ui?: ISDKUIConfiguration | null;
  }

  export interface ISDKUIConfiguration {
    // There is actually a "language: string" special key that the SDK reads and deletes
    // But this complicates the interface way too much for its consumers that will never know about this
    // So we kinda lie in the declaration, and cast it when we need to use it

    /**
     * UI element declaration
     * Key is the UI element name
     */
    [key: string]: ISDKUIElementConfiguration;
  }

  export interface ISDKUIElementConfiguration {
    [key: string]: unknown;
  }

  /**
   * SDK Safari Configuration
   */
  export type ISafariConfig = {
    [key: string]: string;
  };

  /**
   * SDK Event names
   */
  // WARNING: Make sure changes here are made in local-sdk-events.ts
  export enum SDKEvent {
    /**
     * Triggered when the subscription changed
     * The subsription state is given as detail
     */
    SubscriptionChanged = "subscriptionChanged",

    /**
     * Triggered when a module has been initialized
     * The component code and the component itself is given as detail.
     * The component is not necessarily drawn though.
     */
    UiComponentReady = "uiComponentReady",

    /**
     * Triggered when a component has been drawn
     */
    UiComponentDrawn = "uiComponentDrawn",

    /**
     * Triggered when the ui component handler has been intialized
     * and you can start to draw your component.
     */
    UiReady = "uiReady",
  }

  export interface IUIComponentDrawnEventArgs {
    code: string;
    component: unknown;
  }

  export interface IUIComponentReadyEventArgs {
    code: string;
    component: unknown;
  }

  export interface ISubscriptionState {
    /**
     * Determines whether the user is subscribed
     */
    subscribed: boolean;

    /**
     * The notification permission
     */
    permission: NotificationPermission;
  }

  export interface IPublicAPI {
    /**
     * Event Attribute Types.
     * See `TypedEventAttributeType`.
     */
    eventAttributeTypes: typeof TypedEventAttributeType;

    /**
     * User Attribute Types.
     * See `UserAttributeType`.
     */
    userAttributeTypes: typeof UserAttributeType;

    /**
     * Configure the SDK with the given configuration map.
     * Can only be called once.
     *
     * Note: while this is available on the API object, the supported way is to call this using the
     * "short" syntax.
     * Example: batchSDK("setup", {...})
     */
    setup: (config: ISDKConfiguration) => void;

    /**
     * Refresh the service worker registration.
     * If you do anything to the service worker registration while Batch is running, please
     * call this method, as the SDK caches it for performance.
     *
     * Note: depending on Batch's configuration, it might register the service worker
     * as it would have on next page load.
     */
    refreshServiceWorkerRegistration: () => Promise<void>;

    /**
     * Get the current configuration
     */
    getConfiguration: () => ISDKConfiguration;

    /**
     * Associate a user identifier to this installation.
     */
    setCustomUserID: (identifier: string | undefined | null) => Promise<string | null>;

    /**
     * Returns the user identifier associated to this installation
     */
    getCustomUserID: () => Promise<string | null>;

    /**
     * Associate a user language override to this installation
     */
    setUserLanguage: (identifier: string | undefined | null) => Promise<string | null>;

    /**
     * Returns the user language associated to this installation
     */
    getUserLanguage: () => Promise<string | null>;

    /**
     * Associate a user region override to this installation
     */
    setUserRegion: (identifier: string | undefined | null) => Promise<string | null>;

    /**
     * Returns the user region associated to this installation
     */
    getUserRegion: () => Promise<string | null>;

    /**
     * Returns the installation identifier
     */
    getInstallationID: () => Promise<string>;

    /**
     * Determines whether this installation is subscribed to push notifications
     * and can receive notifications (browser notification permission granted, see #getNotificationPermission)
     */
    isSubscribed: () => Promise<boolean>;

    /**
     * Returns the permission state of notifications.
     * Having the permission to display notifications doens't mean that this installation is subscribed to push notifications.
     * - granted : we have the permission
     * - denied : we don't have the permission
     * - default : we don't have, have to ask the user
     */
    getNotificationPermission: () => Promise<NotificationPermission>;

    /**
     * Subscribe this installation to notification.
     * Returns true if the installation is subscribed, false otherwise.
     */
    subscribe: () => Promise<boolean>;

    /**
     * Unsubscribe this installation from notification.
     * Returns true if the installation is unsubscribed, false otherwise.
     */
    unsubscribe: () => Promise<boolean>;

    /**
     * Try to subscrive from the given subscription state.
     * Force asking the permission even if the permission is granted
     *
     * @see #getSubscriptionState to get the "state" parameter value
     */
    tryToSubscribeFrom: (state: ISubscriptionState) => Promise<boolean>;

    /**
     * Returns the raw subscription associated to this insallation.
     * Having a subscription doesn't necessarily mean the installation is subscribed,
     * the user may have unsubscribed or refused notification.
     * Call #isSubscribed() or #getSubscriptionState() to know the exact state of this subscription.
     */
    getSubscription: () => Promise<unknown>;

    /**
     * Returns the subscription state including :
     * - permission : determines the notification permission
     * - subscribed : determines whether the user is subscribed and the permission is granted
     */
    getSubscriptionState: () => Promise<ISubscriptionState>;

    /**
     * Checks if the currently installed service worker's push subscription can be used with
     * the VAPID public key (aka applicationServerKey) defined in the current Batch
     * configuration.
     *
     * This method can be used to detect a VAPID public key  change, which can happen:
     *  - If you already were using Batch but changed the key
     *  - If you are using Batch for the first time but another push provider
     *    was configured and held a registration
     *
     * If there is no worker or no push scubscription, the promise resolves to true as
     * a subscription would most likely succeed.
     *
     * Always returns true on Safari, as it doesn't support standard push notifications.
     */
    doesExistingSubscriptionKeyMatchCurrent: () => Promise<boolean>;

    /**
     * Listen to api events
     *
     * @see SDKEvent enum.
     */
    on: (eventCode: LocalSDKEvent, callback: unknown) => void;

    /**
     * UI related methods
     */
    ui: IUiAPI;

    /**
     * Track an event.
     * @param name The event name. Must be a string made of letters, underscores and numbers only (a-zA-Z0-9_).
     * It also can't be longer than 30 characters.
     * @param eventDataParams eventDataParams (optional). Parameter object, accepting label, attributes and tags, all optional.
     *
     * attributes: Must be a object.
     * The key should be made of letters, numbers or underscores ([a-z0-9_]) and can't be longer than 30 characters.
     *
     * Attribute typing is optional.
     * Supported types:
     * - Date, the value must be a Date
     * - URL, the value must be a string or URL
     * - String, the value must be a string or number
     * - Integer, the value must be a string or number
     * - Double, the value must be a string or number
     * - Boolean, the value must be a boolean or number
     *
     * Type auto detection is possible.
     *
     * tags: Must be a array of string. Can't be longer than 64 characters, and can't be empty or null.
     * label: Must be a string when supplied. It also can't be longer than 200 characters.
     */
    trackEvent: (name: string, eventDataParams?: EventDataParams) => void;

    /**
     * Edit user attributes and tags.
     * @param callback A callback which will be called with an instance of the user data editor.
     *
     * To edit data, pass a function to this method. Batch will call it back with the user data editor as its only parameter.
     * Once your callback ends, Batch will persist the changes.
     *
     * If your edits result in your attributes and tags going over limit, an error will be logged and
     * _all_ of the changes described in the transaction will be rolled back, as if nothing happened.
     * See `https://doc.batch.com/ios/custom-data/custom-attributes` for more info about the limits.
     *
     * Escaping the editor instance is not supported: calling any method on it once your callback has ended _will_
     * throw an exception.
     *
     * See `IUserDataEditor`'s documentation for the methods availalbe on the user data editor.
     */
    editUserData: (callback: (editor: IUserDataEditor) => void) => void;

    /**
     * Read the saved attributes.
     * Returns a Promise that resolves with the attributes.
     */
    getUserAttributes(): Promise<{ [key: string]: IUserAttribute }>;

    /**
     * Read the saved tag collections.
     * Returns a Promise that resolves with the tag collections.
     */
    getUserTagCollections(): Promise<{ [key: string]: string[] }>;
  }

  /**
   * Batch's User Data Editor.
   * See `https://doc.batch.com/ios/custom-data/custom-attributes` for more info.
   */
  interface IUserDataEditor {
    /**
     * Add a tag to a tag collection.
     */
    addTag: (collection: string, tag: string) => IUserDataEditor;

    /**
     * Remove a tag from a tag collection.
     */
    removeTag: (collection: string, tag: string) => IUserDataEditor;

    /**
     * Delete a tag collection and its tags.
     */
    clearTagCollection: (collection: string) => IUserDataEditor;

    /**
     * Delete all tag collections.
     */
    clearTags: () => IUserDataEditor;

    /**
     * Set a user attribute value.
     * @param key Attribute key. Must be a string made of letters, underscores and numbers only (a-zA-Z0-9_).
     * It also can't be longer than 30 characters.
     * @param value Attribute value.
     *
     * If the value is a string, boolean, number, URL or Date: the underlying type will be autodetected.
     *
     * To force an attribute's type, you can set "value" to be an object conforming `UserAttributeValue`, which has two keys:
     *  - type: Expected type. Must be a value of the `api.userAttributeTypes` enum.
     *  - value: Attribute value. Must be a string, boolean, number, URL or Date and coherent with the type.
     *
     * When using UserAttributeValue as a parameter, Batch will enforce the type and either cast it if possible or reject the operation
     * if the value type isn't consistent with the requested type.
     * This ensures that you don't end up with unexpected types in your tagging plan.
     *
     * attributes: Must be a object.
     * The key should be made of letters, numbers or underscores ([a-z0-9_]) and can't be longer than 30 characters.
     *
     * Attribute typing is optional.
     * Supported types:
     * - Date, the value must be a Date
     * - URL, the value must be a string or URL
     * - String, the value must be a string or number
     * - Integer, the value must be a string or number
     * - Double, the value must be a string or number
     * - Boolean, the value must be a boolean or number
     *
     * Type auto detection is possible.
     *
     * See `https://doc.batch.com/ios/custom-data/custom-attributes` for more info.
     */
    setAttribute: (key: string, value: UserAttributeValue | string | boolean | number | URL | Date) => IUserDataEditor;

    /**
     * Remove the attribute associated to a key.
     */
    removeAttribute: (key: string) => IUserDataEditor;

    /**
     * Remove all attributes.
     */
    clearAttributes: () => IUserDataEditor;
  }

  export interface IUiAPI {
    /**
     * Register a new component for the specified code.
     * @param code Unique code for your UI component.
     * @param init Init method of your component: Batch will call you back on it.
     */
    register: (code: string, init: (api: IPublicAPI, config: unknown, onDrawnCallback: (component: unknown) => void) => unknown) => void;

    /**
     * Register a new component for the specified code, after waiting for other components to have been registered
     * @param dependencies Components to wait for before calling this one's init method.
     * @param code Unique code for your UI component.
     * @param init Init method of your component: Batch will call you back on it.
     */
    registerAfter: (
      dependencies: string[],
      code: string,
      init: (api: unknown, config: unknown, onDrawnCallback: (component: unknown) => void) => unknown
    ) => void;

    /**
     * Returns a registered component
     * The component may not be fully ready.
     */
    get: (code: string) => unknown;

    /**
     * Returns whether a component exists for the specified code
     */
    has: (code: string) => boolean;

    /**
     * Returns a promise that is resolved when the specified UI component has been drawn, returning the wrapped component.
     */
    waitUntilDrawn: (componentCode: string) => Promise<unknown>;

    /**
     * Show a UI component once it is ready. For bundled components, this requires them to have been
     * configured in batchSDK.setup()
     *
     * Some components will refuse to show even when calling this method because it might not make sense.
     * For example, the banner will not honor the request if it has been dismissed recently (unless configured otherwise)
     * or if the user is already subscribed to notifications.
     *
     * You can try to set the force parameter to true, asking it to display itself no matter what.
     *
     * If you call this method, you probably want to set "autoShow": false in your UI component configuration
     */
    show: (componentCode: string, force: boolean) => Promise<void>;

    /**
     * Hide a UI component once it is ready. For bundled components, this requires them to have been
     * configured in batchSDK.setup()
     */
    hide: (componentCode: string) => Promise<void>;

    /**
     * Shows the current user's identifiers inside of the current page
     */
    showPublicIdentifiers: () => void;
  }
}
