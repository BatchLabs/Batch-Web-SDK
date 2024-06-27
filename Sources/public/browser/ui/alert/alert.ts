import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";

import { BatchSDK } from "../../../types/public-api";
import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Alert, { IAlertConfig } from "./component";

declare let window: BatchWindow;

const componentName = "alert";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: IAlertConfig, onDrawnCallback: (component: unknown) => void) => {
  const alert = new Alert(api, conf);

  api.on(BatchSDK.SDKEvent.UiReady, (_: never, sub: ISubscriptionState) => {
    alert.draw(sub);
    onDrawnCallback(alert);
  });
  api.on(BatchSDK.SDKEvent.SubscriptionChanged, (_: never, sub: ISubscriptionState) => alert.redraw(sub));

  return alert;
});
