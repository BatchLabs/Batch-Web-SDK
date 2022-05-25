import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";

import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Button, { IButtonConfig } from "./component";

declare let window: BatchWindow;

const componentName = "button";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: IButtonConfig, onDrawnCallback: (component: unknown) => void) => {
  const button = new Button(api, conf);

  api.on(LocalSDKEvent.UiReady, (_: never, sub: ISubscriptionState) => {
    button.draw(sub);
    onDrawnCallback(button);
  });
  api.on(LocalSDKEvent.SubscriptionChanged, (_: never, sub: ISubscriptionState) => button.redraw(sub));

  return button;
});
