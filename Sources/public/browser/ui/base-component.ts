import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { DOMElement } from "com.batch.dom/ui/dom";

import { IBatchSDK } from "../public-api";

export interface IUIComponent {
  show(force: boolean): void;
  hide(): void;
}

export class BaseComponent<IComponentConfig> implements IUIComponent {
  protected readonly api: IBatchSDK;
  protected conf: IComponentConfig;
  protected state?: ISubscriptionState;

  // the outer div
  protected container: DOMElement;

  public constructor(api: IBatchSDK, config: IComponentConfig) {
    this.api = api;
    this.conf = config;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public hide(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public show(_force: boolean): void {}
}
