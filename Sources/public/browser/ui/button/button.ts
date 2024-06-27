import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";

import { BatchSDK } from "../../../types/public-api";
import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Button, { IButtonConfig } from "./component";

declare let window: BatchWindow;

const componentName = "button";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: IButtonConfig, onDrawnCallback: (component: unknown) => void) => {
  const button = new Button(api, conf);

  api.on(BatchSDK.SDKEvent.UiReady, (_: never, sub: ISubscriptionState) => {
    button.draw(sub);
    onDrawnCallback(button);
  });
  api.on(BatchSDK.SDKEvent.SubscriptionChanged, (_: never, sub: ISubscriptionState) => button.redraw(sub));

  return button;
});
