import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";

import type { BatchSDK } from "../../../types/public-api";
import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Popin, { IPopinConfig } from "./component";

declare let window: BatchWindow;

const componentName = "popin";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: unknown, onDrawnCallback: (component: unknown) => void) => {
  const popin = new Popin(api, conf as Partial<IPopinConfig>);

  api.on(LocalSDKEvent.UiReady as unknown as BatchSDK.SDKEvent, (_: unknown, sub: ISubscriptionState) => {
    popin.draw(sub);
    onDrawnCallback(popin);
  });
  api.on(LocalSDKEvent.SubscriptionChanged as unknown as BatchSDK.SDKEvent, (_: unknown, sub: ISubscriptionState) => popin.redraw(sub));

  return popin;
});
