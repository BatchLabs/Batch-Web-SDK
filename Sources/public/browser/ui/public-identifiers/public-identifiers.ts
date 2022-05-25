import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";

import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";
import PublicIdentifiers, { IPublicIdentifiersConfig } from "./component";

declare let window: BatchWindow;

const componentName = "public-identifiers";

window.batchSDK(
  "ui.register",
  componentName,
  (api: IBatchSDK, conf: IPublicIdentifiersConfig, onDrawnCallback: (component: unknown) => void) => {
    const component = new PublicIdentifiers(api, conf);

    api.on(LocalSDKEvent.UiReady, (_: never, sub: ISubscriptionState) => {
      component.draw(sub);
      onDrawnCallback(component);
    });
    api.on(LocalSDKEvent.SubscriptionChanged, (_: never, sub: ISubscriptionState) => component.redraw(sub));
    api.on(LocalSDKEvent.ProfileChanged, (_: never, sub: ISubscriptionState) => component.redraw(sub));

    return component;
  }
);
