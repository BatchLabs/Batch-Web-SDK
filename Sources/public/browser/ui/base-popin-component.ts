// BaseComponent but with a Popin pre-attached
// Note: this needs to be in its own file to fix circular deps issues
import { IBatchSDK } from "../public-api";
import { BaseComponent } from "./base-component";
import Popin from "./popin/component";

export class BasePopinComponent<IComponentConfig> extends BaseComponent<IComponentConfig> {
  protected popin: Popin;

  public constructor(api: IBatchSDK, config: IComponentConfig, popinConfig?: Partial<unknown>) {
    super(api, config);
    this.popin = new Popin(api, popinConfig || {});
  }
}
