import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";

import type { BatchSDK } from "../../../types/public-api";
import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Alert, { IAlertConfig } from "./component";

declare let window: BatchWindow;

const componentName = "alert";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: IAlertConfig, onDrawnCallback: (component: unknown) => void) => {
  const alert = new Alert(api, conf);

  api.on(LocalSDKEvent.UiReady as unknown as BatchSDK.SDKEvent, (_: never, sub: ISubscriptionState) => {
    alert.draw(sub);
    onDrawnCallback(alert);
  });
  api.on(LocalSDKEvent.SubscriptionChanged as unknown as BatchSDK.SDKEvent, (_: never, sub: ISubscriptionState) => alert.redraw(sub));

  return alert;
});
