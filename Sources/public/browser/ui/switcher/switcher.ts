import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";

import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Switcher, { ISwitcherConfig } from "./component";

declare let window: BatchWindow;

const componentName = "switcher";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: ISwitcherConfig, onDrawnCallback: (component: unknown) => void) => {
  const switcher = new Switcher(api, conf);

  api.on(LocalSDKEvent.UiReady, (_: never, sub: ISubscriptionState) => {
    switcher.draw(sub);
    onDrawnCallback(switcher);
  });
  api.on(LocalSDKEvent.SubscriptionChanged, (_: never, sub: ISubscriptionState) => switcher.redraw(sub));

  return switcher;
});
