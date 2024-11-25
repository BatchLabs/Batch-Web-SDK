export namespace BatchSDK {
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
    ARRAY = "a",
    OBJECT = "o",
  }

  /**
   * Event data attribute type
   *
   * Some event attributes have reserved keys, and are all prefixed by a $ sign. This is the list of currently reserved event attributes.
   * You cannot set an event attribute starting by a $ sign.
   */
  export type EventDataAttributeType = {
    /**
     * Event label. Must be a string, will automatically be bridged as label for application event compatibility.
     * Must not be longer than 200 characters
     */
    $label: string;

    /**
     * Event tags. Must be an array of string, will automatically be bridged as tags for application event compatibility.
     * Strings must not be longer than 64 characters and array must not be longer than 10 items.
     */
    $tags: Array<string>;

    /**
     * All event's attributes.
     */
    [key: string]:
      | string
      | boolean
      | number
      | URL
      | Date
      | Array<string | EventObjectAttributeValueType>
      | EventObjectAttributeValueType
      | EventAttributeValue;
  };

  type EventObjectAttributeValueType = {
    [key: string]: string | boolean | number | URL | Date | Array<string | EventObjectAttributeValueType> | EventObjectAttributeValueType;
  };
  type EventAttributeValue =
    | { type: TypedEventAttributeType.BOOLEAN; value: boolean | number }
    | { type: TypedEventAttributeType.STRING; value: string }
    | { type: TypedEventAttributeType.URL; value: string | URL }
    | { type: TypedEventAttributeType.INTEGER; value: number | `${number}` }
    | { type: TypedEventAttributeType.FLOAT; value: number | `${number}` }
    | { type: TypedEventAttributeType.DATE; value: Date }
    | { type: TypedEventAttributeType.ARRAY; value: Array<string | EventObjectAttributeValueType> }
    | { type: TypedEventAttributeType.OBJECT; value: EventObjectAttributeValueType };

  export type EventDataParams = {
    /**
     * Event attributes. Keys are the attribute names. Some keys are documented as they're reserved.
     * See `EventDataAttributeType` for more info.
     */
    attributes?: EventDataAttributeType;
  };

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

  export type UserAttributeValue =
    | { type: UserAttributeType.BOOLEAN; value: boolean | number }
    | { type: UserAttributeType.STRING; value: string }
    | { type: UserAttributeType.URL; value: string | URL }
    | { type: UserAttributeType.INTEGER; value: number | `${number}` }
    | { type: UserAttributeType.FLOAT; value: number | `${number}` }
    | { type: UserAttributeType.DATE; value: Date };

  /**
   * Object representing a user attribute.
   * An attribute is represented by its type, which matches the one you've used
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

  /**
   * Profile attribute types.
   *
   * This enum's implementation is available on api.userAttributeTypes.
   */
  export enum ProfileAttributeType {
    STRING = "s",
    BOOLEAN = "b",
    INTEGER = "i",
    FLOAT = "f",
    DATE = "t",
    URL = "u",
    ARRAY = "a",
  }

  export type ProfileTypedAttributeValue =
    | { type: ProfileAttributeType.BOOLEAN; value: boolean | number }
    | { type: ProfileAttributeType.STRING; value: string }
    | { type: ProfileAttributeType.URL; value: string | URL }
    | { type: ProfileAttributeType.INTEGER; value: number | `${number}` }
    | { type: ProfileAttributeType.FLOAT; value: number | `${number}` }
    | { type: ProfileAttributeType.DATE; value: Date }
    | { type: ProfileAttributeType.ARRAY; value: Array<string> };

  export type ProfileAttributeValue =
    | ProfileTypedAttributeValue
    | string
    | boolean
    | number
    | URL
    | Date
    | Array<string>
    | null
    | undefined;

  /**
   * Batch's Profile Module.
   */
  export interface IProfile {
    /**
     * Identify the current user.
     *
     * Attach the current installation to a Profile.
     * @param identifier An object containing the `customId`.
     *
     * Return a promise that resolve the IProfile instance.
     *
     * See `https://doc.batch.com/web/custom-data/customid` for more info.
     */
    identify: (identifier: { customId?: string } | null | undefined) => Promise<IProfile>;

    /**
     * Edit profile's attributes.
     * @param callback A callback which will be called with an instance of the profile data editor.
     *
     * To edit data, pass a function to this method. Batch will call it back with the profile data editor as its only parameter.
     * Once your callback ends, Batch will persist the changes.
     *
     * If your edits result in your attributes going over limit, an error will be logged and
     * _all_ of the changes described in the transaction will be rolled back, as if nothing happened.
     * See `https://doc.batch.com/web/custom-data/custom-attributes` for more info about the limits.
     *
     * Escaping the editor instance is not supported: calling any method on it once your callback has ended _will_
     * throw an exception.
     *
     * See `ProfileDataEditor`'s documentation for the methods available on the user data editor.
     *
     * Return a promise that resolve the IProfile instance.
     */
    edit: (callback: (editor: IProfileDataEditor) => void) => Promise<IProfile>;
  }

  /**
   * Batch's Profile Data Editor.
   * See `https://doc.batch.com/ios/custom-data/custom-attributes` for more info.
   */
  interface IProfileDataEditor {
    /**
     * Associate a language to this profile.
     * @param language must be 2 chars, lowercase, ISO 639 formatted
     */
    setLanguage: (language: string | undefined | null) => IProfileEditor;

    /**
     * Associate a region to this profile.
     * @param region must be 2 chars, uppercase, ISO 3166 formatted
     */
    setRegion: (region: string | undefined | null) => IProfileEditor;

    /**
     * Associate an email address to this profile.
     *
     * This requires to have a custom user ID registered with the `identify` API.
     * @param email must be valid, not longer than 256 characters. It must match the following pattern: ^[^@]+@[A-z0-9\-\.]+\.[A-z0-9]+$.
     * Null to erase.
     */
    setEmailAddress: (email: string | undefined | null) => IProfileEditor;

    /**
     * The profile's marketing emails subscription.
     *
     * Note that profile's subscription status is automatically set to unsubscribed when they click an unsubscribe link.
     * @param state You can set it to subscribed or unsubscribed.
     */
    setEmailMarketingSubscription: (state: "subscribed" | "unsubscribed") => IProfileEditor;

    setAttribute: (key: string, value: ProfileAttributeValue) => IProfileEditor;
    removeAttribute: (key: string) => IProfileEditor;

    addToArray: (key: string, value: Array<string>) => IProfileEditor;
    removeFromArray: (key: string, value: Array<string>) => IProfileEditor;
  }

  export interface ISDKConfiguration {
    dev: boolean;
    smallIcon?: string;
    defaultIcon?: string;
    subdomain?: string;
    authKey: string;
    apiKey: string;
    vapidPublicKey?: string;
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
    /**
     * Service Worker related configuration
     */
    serviceWorker?: ISDKServiceWorkerConfiguration;
    /**
     * Default data collection related configuration
     */
    defaultDataCollection?: ISDKDefaultDataCollectionConfiguration;
    /**
     * Migrations related configuration
     */
    migrations?: ISDKMigrationsConfiguration;
  }

  /**
   * Data migrations related configuration
   */
  export interface ISDKMigrationsConfiguration {
    /**
     *  SDK V4 migrations related configuration
     */
    v4?: {
      /**
       * Whether Bath should automatically identify logged-in user when running the SDK for the first time.
       * This mean user with a custom_user_id will be automatically attached a to a Profile
       * and can be targeted within a Project scope.
       * Default: true
       */
      customID?: boolean;

      /**
       * Whether Bath should automatically attach current installation's data (language/region/customDataAttributes...)
       * to the User's Profile when running the SDK for the first time.
       * Default: true
       */
      customData?: boolean;
    };
  }

  export interface ISDKServiceWorkerConfiguration {
    /**
     * Maximum waiting time for your Service Worker to be ready (default: 10 seconds).
     */
    waitTimeout?: number;

    /**
     * Whether Batch should automatically register its service worker (default: true).
     */
    automaticallyRegister?: boolean;

    /**
     * Allows you to have Batch use a specific Service Worker registration. (requires `automaticallyRegister` to be false).
     */
    registration?: Promise<ServiceWorkerRegistration>;
  }

  export interface ISDKDefaultDataCollectionConfiguration {
    /**
     * Whether Batch should resolve the user's region/location from the ip address (default: false).
     */
    geoIP?: boolean;
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
     * The subscription state is given as detail
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
     * Triggered when the ui component handler has been initialized,
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
     * Returns the user language associated to this installation
     */
    getUserLanguage: () => Promise<string | null>;

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
     * Having the permission to display notifications doesn't mean that this installation is subscribed to push notifications.
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
     * Try to subscribe from the given subscription state.
     * Force asking the permission even if the permission is granted
     *
     * @see #getSubscriptionState to get the "state" parameter value
     */
    tryToSubscribeFrom: (state: ISubscriptionState) => Promise<boolean>;

    /**
     * Returns the raw subscription associated to this installation.
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
     * If there is no worker or no push subscription, the promise resolves to true as
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
    on: (eventCode: SDKEvent, callback: unknown) => void;

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
     * attributes: Must be an object.
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
     * - Array, the value must be an array of strings
     * - Object, the value must be an object containing the above types
     *
     * Type auto-detection is possible.
     *
     * If you were previously using `label`and `tags`you can specify in the `attributes`object the reserved keys:
     * $tags: Must be n array of string. Can't be longer than 64 characters, and can't be empty or null.
     * $label: Must be a string when supplied. It also can't be longer than 200 characters.
     */
    trackEvent: (name: string, eventDataParams?: EventDataParams) => void;

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

    /**
     * Clear the custom data of this installation.
     *
     * This mean removing all attributes attached to the user's installation but Profile's data will not be removed.
     */
    clearInstallationData(): Promise<void>;

    /**
     * Get the Profile module
     *
     * Returns a Promise that resolves with the profile's APIs
     */
    profile(): Promise<IProfile>;
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
     * Shows the current user's identifiers inside the current page
     */
    showPublicIdentifiers: () => void;
  }
}
