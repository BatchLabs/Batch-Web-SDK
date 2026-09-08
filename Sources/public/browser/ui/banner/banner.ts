import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";

import type { BatchSDK } from "../../../types/public-api";
import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import Banner, { IBannerConfig } from "./component";

declare let window: BatchWindow;

const componentName = "banner";

window.batchSDK("ui.register", componentName, (api: IBatchSDK, conf: IBannerConfig, onDrawnCallback: (component: unknown) => void) => {
  const banner = new Banner(api, conf);

  api.on(LocalSDKEvent.UiReady as unknown as BatchSDK.SDKEvent, (_: never, sub: ISubscriptionState) => {
    banner.draw(sub);
    onDrawnCallback(banner);
  });
  api.on(LocalSDKEvent.SubscriptionChanged as unknown as BatchSDK.SDKEvent, (_: never, sub: ISubscriptionState) => banner.redraw(sub));

  return banner;
});
