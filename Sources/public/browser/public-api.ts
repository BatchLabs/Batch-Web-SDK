import { ISDK, ISubscriptionState, Permission } from "com.batch.dom/sdk-impl/sdk";
import { createSDKFactory } from "com.batch.dom/sdk-impl/sdk-factory";
import getTranslator from "com.batch.dom/ui/translator";
import { UIComponentHandler, UIComponentState } from "com.batch.dom/ui/uicomponent-handler";
import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { asBoolean } from "com.batch.shared/helpers/primitive";
import { Evt, LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent, { IUIComponentReadyEventArgs } from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";
import { UserAttributeEditor } from "com.batch.shared/user/user-attribute-editor";

import { SDK_VERSION } from "../../config";
import { BatchSDK } from "../types/public-api";
import { IUIComponent } from "./ui/base-component";

const logModuleName = "public-api";
const RUNS_ON_ORIGIN = true;

enum TypedEventAttributeType {
  STRING = "s",
  BOOLEAN = "b",
  INTEGER = "i",
  FLOAT = "f",
  DATE = "t",
  URL = "u",
}

enum UserAttributeType {
  STRING = "s",
  BOOLEAN = "b",
  INTEGER = "i",
  FLOAT = "f",
  DATE = "t",
  URL = "u",
}

export default function newPublicAPI(): BatchSDK.IPublicAPI {
  /**
   * Original configuration the developer called 'setup' with
   */
  let originalConfig: BatchSDK.ISDKConfiguration;

  /**
   * Promise to ensure the dom is ready (we don't want to miss it)
   */

  const ready: Promise<void> = new Promise<void>(resolve => {
    // Old safari browsers returned "loaded", unfortunately TS doesn't ship that value in their definition
    // and we don't live in their ideal world
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (document.readyState === "complete" || (document as any).readyState === "loaded" || document.readyState === "interactive") {
      resolve();
    } else {
      Log.debug(logModuleName, "Waiting for DOM to be ready");
      // useCapture should be 'true' to avoid us missing it because a misbehaving website
      // intercepted it
      // If there is another issue with a website calling e.stopImmediatePropagation(),
      // we will have to implement "readystatechange" alongside "DOMContentLoaded".
      window.addEventListener(
        "DOMContentLoaded",
        () => {
          resolve();
        },
        true
      );
    }
  }).then(() => {
    Log.debug(logModuleName, "DOM is ready");
  });

  /**
   * Instance accessor
   */

  let instance: Promise<ISDK> | null = null;
  function getInstance(): Promise<ISDK> {
    return (instance || Promise.reject("Batch is not initialized yet. Have you called 'setup' before calling Batch's API?")).catch(e => {
      // tslint:disable-next-line:no-string-throw
      throw "Batch SDK: Could not initialize Public API: " + e;
    });
  }

  /**
   * Public event bus
   */

  const eventBus = LocalEventBus;

  /**
   * UI Components
   */
  const uiComponents = new UIComponentHandler();

  /**
   * Setup nonce
   */
  let setupCalled = false;

  // tslint:disable object-literal-sort-keys
  /**
   * BatchSDK's public API.
   *
   * These methods are available as forwarded calls using the short syntax,
   * or can be accessed behind the full API promise, accessible using window.batchSDK.
   *
   * Most of these methods will return a
   * [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).
   *
   * It also handles UI components directly on behalf of the SDK
   * (Yes, it does too much, no it's not intuitive and yes, this should change)
   *
   * Ex: `window.batchSDK(api => api.getInstallationID().then(console.log))`
   * @public
   */
  const api: BatchSDK.IPublicAPI = {
    /**
     * Setup the Batch SDK and return a promise when ready
     * @private
     */
    setup: (config: BatchSDK.ISDKConfiguration) => {
      if (setupCalled) {
        Log.publicError("'setup' cannot be called twice. Ignoring.");
        return;
      }
      setupCalled = true;

      originalConfig = deepClone(config); // Keep a separate clone because the sdk will modify it
      config = deepClone(config);

      const uiConfig = config.ui;
      if (uiConfig && typeof uiConfig.language === "string") {
        getTranslator().setLanguage(uiConfig.language);
        delete uiConfig.language;
      }

      const origin = document.location.origin.toLowerCase();

      const sdkConfig: IPrivateBatchSDKConfiguration = Object.assign({}, config, {
        internal: {
          // This erases "internal" in the public config, on purpose
          origin: origin.startsWith("http") ? origin : null,
          referrer: document.location.href.toLowerCase(),
        },
        ui: null,
      });

      const isSecure = window.isSecureContext;
      if (!isSecure) {
        Log.warn(logModuleName, "Insecure origin: notification push will not work.");
      }

      if (sdkConfig.sameOrigin) {
        throw new Error('Remove "sameOrigin" from the SDK configuration, or downgrade the SDK to the previous major version.');
      }

      if (asBoolean(sdkConfig.dev, false)) {
        Log.public(
          "Starting version " + SDK_VERSION + " in development mode.",
          "Environment: " + (RUNS_ON_ORIGIN ? "Fully secure" : "HTTP/Multidomain (subdomain: " + sdkConfig.subdomain + ")")
        );
      }

      instance = ready.then(async () => {
        const factory = await createSDKFactory();
        return factory.setup(sdkConfig);
      });

      // Handle window hash change
      // This should be done in the SDK itself but we have three unrelated implementations of it...
      // Also this file already handles UI components and it's one so setup it here
      if (window) {
        if (sdkConfig.enableHashFeatures) {
          window.addEventListener("hashchange", (e: HashChangeEvent): void => {
            if (e.newURL) {
              const url = new URL(e.newURL);
              if (url.hash !== "") {
                LocalEventBus.emit(LocalSDKEvent.HashChanged, { hash: url.hash }, true);
              }
            }
          });
          // Emit the initial hash to be consistent
          const currentHash = window.location.hash;
          if (currentHash !== "") {
            LocalEventBus.emit(LocalSDKEvent.HashChanged, { hash: currentHash }, true);
          }
          Log.debug("Core", "Hash features have been enabled by configuration, listening to 'hashchange'.");
        }
      }

      // Start the SDK and handle events
      instance
        .then(async sdk => {
          await sdk.start();

          // init ui components
          const uiReady = uiComponents.init(uiConfig || {});

          sdk.getInstallationID().then(iid => {
            if (sdkConfig.dev) {
              Log.public("Installation ID: " + (iid || "unknown"));
            }
          });

          /**
           * Start emitting browser events as soon as the ui is ready.
           * This part is executed in background (do not return any promise),
           * because we don't want the setup to depends on the ui.
           *
           * Though, we want (for future use) the last subscription state to
           * be available as soon as the the sdk is setup.
           */

          const subPromise = sdk.getSubscriptionState();

          uiReady
            .catch(e => Log.warn(logModuleName, "Error while initializing the ui :", e))
            .then(() => subPromise)
            .then(state => LocalEventBus.emit(LocalSDKEvent.UiReady, state, false));
        })
        .catch(e => Log.error(logModuleName, "Error while initiliazing batch SDK :", e));
    },

    /**
     * Get the configuration that was used to setup the SDK
     */
    getConfiguration: () => deepClone(originalConfig),

    refreshServiceWorkerRegistration: () => getInstance().then(sdk => sdk.refreshServiceWorkerRegistration()),

    /**
     * Associate a user identifier to this installation
     * @public
     */
    setCustomUserID: (identifier: string | undefined) => getInstance().then(sdk => sdk.setCustomUserID(identifier)),

    /**
     * Returns the user identifier you did associate to this installation
     * @public
     */
    getCustomUserID: () => getInstance().then(sdk => sdk.getCustomUserID()),

    /**
     * Associate a user language to this installation
     * @public
     */
    setUserLanguage: (language: string | undefined) => getInstance().then(sdk => sdk.setLanguage(language)),

    /**
     * Returns the user language you did associate to this installation
     * @public
     */
    getUserLanguage: () => getInstance().then(sdk => sdk.getLanguage()),

    /**
     * Associate a user region to this installation
     * @public
     */
    setUserRegion: (region: string | undefined) => getInstance().then(sdk => sdk.setRegion(region)),

    /**
     * Returns the user region you did associate to this installation
     * @public
     */
    getUserRegion: () => getInstance().then(sdk => sdk.getRegion()),

    /**
     * Returns the identifier associated to this installation
     * @public
     */
    getInstallationID: () => getInstance().then(sdk => sdk.getInstallationID()),

    /**
     * Determines whether this install is subscribed to the push
     * and can receive notifications (permission is granted, see #getNotificationPermission)
     * @public
     */
    isSubscribed: () => getInstance().then(sdk => sdk.isSubscribed()),

    /**
     * Returns the permission of notifications.
     * Having the permission doens't mean that this installation is subscribed to push notifications.
     * - granted : we have the permission
     * - denied : we don't have the permission
     * - default : we don't have, have to ask the user
     * @public
     */
    getNotificationPermission: (): Promise<Permission> => getInstance().then(sdk => sdk.getPermission()),

    /**
     * Subscribe this installation to notification.
     * Returns true if the installation is subscribed, false otherwise.
     * @public
     */
    subscribe: (): Promise<boolean> => getInstance().then(sdk => sdk.subscribe()),

    /**
     * Unsubscribe this installation from notification.
     * Returns true if the installation is unsubscribed, false otherwise.
     * @public
     */
    unsubscribe: (): Promise<boolean> => getInstance().then(sdk => sdk.unsubscribe()),

    /**
     * Try to subscrive from the given subscription state.
     * Force asking the permission even if the permission is granted
     *
     * @public
     */
    tryToSubscribeFrom: (state: ISubscriptionState): Promise<boolean> => {
      if (state == null) {
        // don't go further
        return Promise.reject("No state given");
      }

      let p: Promise<boolean> = Promise.resolve(false);

      if (state.subscribed) {
        // already subscribed, according the state
        p = api.isSubscribed();
      } else {
        // try to subscribe
        p = api.subscribe();
      }

      return p;
    },

    /**
     * Returns the subscription associated to this insallation.
     * Having a subscription doesn't necessarily mean the installation is subscribed,
     * the user may have unsubscribed or refused notification.
     * Call the #isSubscribed() or #getSubscriptionState() to know the exact state of this subscription.
     * @public
     */
    getSubscription: () => getInstance().then(sdk => sdk.getSubscription()),

    /**
     * Returns the subscription state including :
     * - permission : determines the notification permission
     * - subscribed : determines whether the user is subscribed and the permission is granted
     * @public
     */
    getSubscriptionState: (): Promise<ISubscriptionState> => getInstance().then(sdk => sdk.getSubscriptionState()),

    /**
     * Checks if the current pushManager applicationServerKey match what Batch has been configured with.
     * See public-api.d.ts for more info.
     */
    doesExistingSubscriptionKeyMatchCurrent: (): Promise<boolean> =>
      getInstance().then(sdk => sdk.doesExistingSubscriptionKeyMatchCurrent()),

    /**
     * Listen to events api events
     * @public
     */
    on: (eventCode: LocalSDKEvent, callback: (api: BatchSDK.IPublicAPI, detail: unknown, event: Evt) => void) => {
      eventBus.subscribe(eventCode, (detail: unknown, evt: Evt) => callback(api, detail, evt));
    },

    /**
     *
     * Track an event.
     * @public
     */
    trackEvent: (name: string, params?: BatchSDK.EventDataParams) => getInstance().then(sdk => sdk.trackEvent(name, params)),

    eventAttributeTypes: Object.freeze(TypedEventAttributeType),
    userAttributeTypes: Object.freeze(UserAttributeType),

    editUserData: (callback: (editor: UserAttributeEditor) => void): void => {
      getInstance().then(sdk => {
        sdk.editUserData(callback);
      });
    },

    getUserAttributes: async () => getInstance().then(sdk => sdk.getUserAttributes()),

    getUserTagCollections: async () => getInstance().then(sdk => sdk.getUserTagCollections()),

    /**
     * UI components attached to the sdk
     * See the batch documentation for more details
     *
     * @public
     */
    ui: {
      /**
       * Register a new component with the given init function
       */
      register: (
        code: string,
        init: (
          api: BatchSDK.IPublicAPI,
          config: BatchSDK.ISDKUIElementConfiguration,
          onDrawnCallback: (component: unknown) => void
        ) => unknown
      ) => {
        function wrap(config: BatchSDK.ISDKUIElementConfiguration): unknown {
          const compConfigWithTrans = getTranslator().populateDefaultComponentText(config, code);
          compConfigWithTrans.popin = getTranslator().populateDefaultComponentText(
            (compConfigWithTrans.popin || {}) as BatchSDK.ISDKUIElementConfiguration,
            "popin"
          );

          return init(api, compConfigWithTrans, component => {
            LocalEventBus.emit(LocalSDKEvent.UiComponentDrawn, { code, component }, false);
          });
        }
        uiComponents.add(code, wrap);
      },

      registerAfter: (
        dependencies: string[],
        code: string,
        init: (api: unknown, config: unknown, onDrawnCallback: (component: unknown) => void) => unknown
      ) => {
        // the list of dependencies we're waiting for
        const waitingFor = new Set(dependencies);

        if (waitingFor.size === 0) {
          // avoid waiting forever
          api.ui.register(code, init);
        } else {
          eventBus.subscribe(LocalSDKEvent.UiComponentReady, (cready: IUIComponentReadyEventArgs) => {
            if (waitingFor.delete(cready.code) && waitingFor.size === 0) {
              api.ui.register(code, init);
            }
          });
        }
      },

      /**
       * Returns a registered components
       * The component may not be initialized yet.
       */
      get: (code: string) => {
        const c = uiComponents.getComponent(code);
        return c != null ? c.component : null;
      },

      /**
       * Determines whether this component exists
       */
      has: (code: string): boolean => uiComponents.getComponentState(code) === UIComponentState.LOADED,

      /**
       * Returns a promise that is resolved when the specified UI component has been drawn, passing it as a parameter
       */
      waitUntilDrawn: (componentCode: string): Promise<unknown> => {
        return uiComponents.waitUntilDrawn(componentCode);
      },

      /**
       * Show a UI component once it is ready. This requires the component to have been
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
      show: (componentCode: string, force: boolean): Promise<void> => {
        force = force || false;

        return api.ui.waitUntilDrawn(componentCode).then((c: IUIComponent) => {
          if (typeof c.show === "function") {
            c.show(force);
          }
        });
      },

      /**
       * Hide a UI component once it is ready. This requires the component to have been
       * configured in batchSDK.setup()
       */
      hide: (componentCode: string): Promise<void> => {
        return api.ui.waitUntilDrawn(componentCode).then((c: IUIComponent) => {
          if (typeof c.hide === "function") {
            c.hide();
          }
        });
      },

      showPublicIdentifiers: (): Promise<void> => {
        return uiComponents.showPublicIdentifiers();
      },
    },
  };

  return api;
}

// Dirty trick to extract the public API type, until we refactor it into a separate .d.ts
// https://stackoverflow.com/a/46587275
// eslint-disable-next-line
const returnTypeExtractor = <T>(_fn: () => T) => ({} as T);
const publicApiType = returnTypeExtractor(newPublicAPI);

export type IBatchSDK = typeof publicApiType;
