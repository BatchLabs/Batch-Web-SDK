// WARNING: Some events here are duplicated in the public API,
// So make sure changes here are also made in public-api.d.ts if needed.

import { IUIComponent } from "../../public/browser/ui/base-component";

enum LocalSDKEvent {
  /**
   * Meta event representing all events
   * Cannot be triggered
   */
  All = "*",

  /**
   * Triggered when a new session is started
   */
  SessionStarted = "sessionStarted",

  /**
   * Triggered when the profile changed
   */
  NativeDataChanged = "nativeDataChanged",

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
   * Triggered when the ui component handler has been intialized
   * and you can start to draw your component.
   */
  UiReady = "uiReady",

  /**
   * Triggered when the URL hash changes to a non-empty value.
   * Is artificially triggered on first load if a hash is present.
   */
  HashChanged = "hashChanged",

  /**
   * Triggered when the push probation changes.
   */
  ExitedProbation = "exitedProbation",

  /**
   * Triggered when device language or timezone has changed
   */
  SystemParameterChanged = "systemParameterChanged",

  /**
   * Trigger when the project has changed
   */
  ProjectChanged = "projectChanged",
}

export interface IUIComponentDrawnEventArgs {
  code: string;
  component: IUIComponent;
}

export interface IUIComponentReadyEventArgs {
  code: string;
  component: unknown;
}

export interface IHashChangedEventArgs {
  hash: string;
}

export default LocalSDKEvent;
