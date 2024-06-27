import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";

import { BatchSDK } from "../../../types/public-api";
import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Popin, { IPopinConfig } from "./component";

declare let window: BatchWindow;

const componentName = "popin";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: unknown, onDrawnCallback: (component: unknown) => void) => {
  const popin = new Popin(api, conf as Partial<IPopinConfig>);

  api.on(BatchSDK.SDKEvent.UiReady, (_: unknown, sub: ISubscriptionState) => {
    popin.draw(sub);
    onDrawnCallback(popin);
  });
  api.on(BatchSDK.SDKEvent.SubscriptionChanged, (_: unknown, sub: ISubscriptionState) => popin.redraw(sub));

  return popin;
});
