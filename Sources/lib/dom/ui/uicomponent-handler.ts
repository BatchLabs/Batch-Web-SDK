import { IS_WEBPACK_DEV_SERVER, SDK_VERSION, SSL_SCRIPT_URL } from "com.batch.shared/../../config";
import BatchError from "com.batch.shared/batch-error";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent, { IHashChangedEventArgs, IUIComponentDrawnEventArgs } from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";

import { IUIComponent } from "../../../public/browser/ui/base-component";
import { BatchSDK } from "../../../public/types/public-api";
import { doc } from "./dom";

const PUBLIC_IDENTIFIERS_COMPONENT_NAME = "public-identifiers";

// native components handled by batch
const publicComponents = ["button", "banner", "switcher", "popin", "alert", "native"];
const privateComponents = [PUBLIC_IDENTIFIERS_COMPONENT_NAME];
const logModuleName = "ui-component-handler";

const baseComponentUrl = IS_WEBPACK_DEV_SERVER ? `${document.location.origin}/` : `https://${SSL_SCRIPT_URL}/${SDK_VERSION}/`;

export type UIComponentSetupFunction = (config: BatchSDK.ISDKUIElementConfiguration) => unknown;

export enum UIComponentState {
  UNKNOWN,
  LOADING,
  LOADED,
}

/**
 * A ui component.
 */
export class UIComponent {
  /**
   * The ui code
   */
  public code: string;

  /**
   * The function to init the component
   */
  public initFunction: UIComponentSetupFunction;

  /**
   * The running promise whether the component is loaded or initializing
   */
  public promise?: Promise<unknown> | null;

  /**
   * An internal object representing the component
   * returned by the init function (can be behind a promise)
   */
  public component?: unknown;

  /**
   * Determines whether this component
   * has been loaded with success.
   * Have sense only if the promise is finished, in other words if initialized() returns true
   */
  public success: boolean;

  // ----------------------------------->

  /**
   * Creates a new UI component
   */
  public constructor(code: string, initFunction: UIComponentSetupFunction) {
    this.code = code;
    this.initFunction = initFunction;
    this.promise = null;
    this.component = null;
    this.success = false;
  }

  // ----------------------------------->

  /**
   * Determines whether the component is ready
   */
  public ready(): boolean {
    return this.component != null;
  }

  /**
   * Determines whether the component is initialized
   */
  public initialized(): boolean {
    return this.promise != null;
  }

  /**
   * Determines whether we're currently initializing the component
   */
  public intializing(): boolean {
    return this.initialized() && !this.ready();
  }

  /**
   * Init, if not already initialized
   */
  public init(conf: BatchSDK.ISDKUIElementConfiguration): Promise<unknown> {
    if (this.initialized()) {
      Log.warn(logModuleName, "The module is already initialized", this.code);
      if (this.promise instanceof Promise) {
        return this.promise;
      }
    }

    // call the init function
    Log.debug(logModuleName, "Init component", this.code);
    const res = this.initFunction(conf);

    // store the promise
    const prom: Promise<unknown> = res instanceof Promise ? res : Promise.resolve(res);

    this.promise = prom
      .then(r => {
        this.success = true;
        return (this.component = r == null ? {} : r);
      })
      .catch(e => {
        Log.warn(logModuleName, "Error while initializing the component", this.code, e);
        this.success = false;
        return (this.component = {});
      });

    // emit events
    this.promise
      .then(() => {
        if (this.success) {
          LocalEventBus.emit(LocalSDKEvent.UiComponentReady, { code: this.code, component: this.component }, false);
        }
      })
      .catch(e => Log.warn(logModuleName, "Error while initializing the component", this.code, e));

    return this.promise;
  }
}

/**
 * Handle ui components
 */
export class UIComponentHandler {
  /**
   * The list of components
   */
  public components: Map<string, UIComponent>;

  /**
   * The list of components that are currently loading
   */
  public loadingComponents: Set<string>;

  /**
   * The ui config, to init components
   */
  public config: BatchSDK.ISDKUIConfiguration | null;

  // ----------------------------------->

  public constructor() {
    this.components = new Map();
    this.loadingComponents = new Set();
    this.config = null;
    LocalEventBus.subscribe(LocalSDKEvent.HashChanged, this.onHashChanged.bind(this));
  }

  // ----------------------------------->

  private onHashChanged(args: IHashChangedEventArgs): void {
    if (args.hash === "#_batchsdk_show_identifiers") {
      void this.showPublicIdentifiers();
    }
  }

  // ----------------------------------->

  /**
   * Add a new component
   */
  public add(code: string, initFunction: UIComponentSetupFunction): UIComponent {
    if (this.getComponentState(code) == UIComponentState.LOADED) {
      throw new BatchError("The component " + code + " already exists");
    }

    this.loadingComponents.delete(code);

    const component = new UIComponent(code, initFunction);

    Log.info(logModuleName, "Add new component", code);
    this.components.set(code, component);

    if (this.config != null) {
      void component.init(this.config[code] || {});
    }

    return component;
  }

  /**
   * Get a component using the given code, null if not found
   */
  public getComponent(code: string): UIComponent | null {
    return this.components.get(code) || null;
  }

  /**
   * Determines the loading state of the component
   */
  public getComponentState(code: string): UIComponentState {
    if (this.loadingComponents.has(code)) {
      return UIComponentState.LOADING;
    }
    if (this.components.get(code)) {
      return UIComponentState.LOADED;
    }
    return UIComponentState.UNKNOWN;
  }

  /**
   * Determines if we need to start loading this component
   */
  public shouldLoadComponent(code: string): boolean {
    return this.getComponentState(code) == UIComponentState.UNKNOWN;
  }

  // ----------------------------------->
  // native components

  /**
   * Determines whether this component is known by the SDK and loadable
   * using a predictable URL
   */
  private isKnownComponent(code: string): boolean {
    return publicComponents.indexOf(code) !== -1 || privateComponents.indexOf(code) !== -1;
  }

  /**
   * Determines whether this component is known by the SDK and can be
   * referenced via the public "ui" configuration
   */
  private isPublicComponent(code: string): boolean {
    return publicComponents.indexOf(code) !== -1;
  }

  /**
   * Insert a script tag to load the native component
   */
  public loadNativeComponentScript(code: string): Promise<boolean> {
    if (!this.shouldLoadComponent(code)) {
      return Promise.reject(`Refusing to load component ${code}: it is already loaded or is loading.`);
    }

    if (!this.isKnownComponent(code)) {
      return Promise.reject(`Refusing to load component ${code}: it is not part of the known loadable components`);
    }

    const url = `${baseComponentUrl}${code}.min.js`;
    return new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.async = true;
      tag.src = url;
      tag.onload = () => resolve(true);
      tag.onerror = () => {
        this.loadingComponents.delete(code);
        reject("Loading error");
      };

      if (doc.getByTag("script").first().before(tag, false).empty()) {
        reject(new Error("Unable to insert the script " + url));
        return;
      }

      this.loadingComponents.add(code);
    });
  }

  /**
   * Auto load native components by inserting script if not already inserted
   */
  public autoLoadNativeComponents(config: BatchSDK.ISDKUIConfiguration): Promise<void> {
    // Only allow public components to be referenced from the UI configuration
    const loadingPromises = Object.keys(config)
      .filter(code => this.isPublicComponent(code))
      .map(componentCode => this.loadNativeComponentScript(componentCode));

    return Promise.all(loadingPromises).then(() => Promise.resolve());
  }

  /**
   * Loads the public identifiers UI component.
   * It will show itself automatically once ready.
   *
   * This component displays the current Custom ID and Installation ID on screen.
   */
  public async showPublicIdentifiers(): Promise<void> {
    try {
      await this.loadNativeComponentScript(PUBLIC_IDENTIFIERS_COMPONENT_NAME);
    } catch {
      // We don't care if this promise fails, it just means that the component has already been loaded
    }
    const component = await this.waitUntilDrawn(PUBLIC_IDENTIFIERS_COMPONENT_NAME);
    component.show(true);
  }

  // ----------------------------------->
  // public API

  public waitUntilDrawn<T extends IUIComponent>(componentCode: string): Promise<T> {
    return new Promise(resolve => {
      // Unfortuately LocalEventBus will keep a lifelong reference to this, even when resolved
      LocalEventBus.subscribe(LocalSDKEvent.UiComponentDrawn, (data: IUIComponentDrawnEventArgs) => {
        if (data.code === componentCode && data.component) {
          resolve(data.component as T);
        }
      });
    });
  }

  // ----------------------------------->

  /**
   * Init all the components.
   * For each component, the handler will seek into the config object using the component code.
   */
  public init(config: BatchSDK.ISDKUIConfiguration): Promise<unknown> {
    // keep the config for further adds
    this.config = config;

    return this.autoLoadNativeComponents(config).then(() => {
      // init not intialized modules
      const promises: Array<Promise<unknown>> = [];

      this.components.forEach((value, key) => {
        if (!value.initialized()) {
          promises.push(value.init(config[key] || {}));
        }
      });

      return Promise.all(promises);
    });
  }
}
