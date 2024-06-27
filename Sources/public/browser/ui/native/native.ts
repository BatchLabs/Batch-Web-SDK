import { ISubscriptionState, Permission } from "com.batch.dom/sdk-impl/sdk";

import { BatchSDK } from "../../../types/public-api";
import { IBatchSDK } from "../../public-api";
import { BatchWindow } from "../sdk";

declare let window: BatchWindow;

const componentName = "native";

const LSKEY = "_batch_ui_native_prompt_dismissed";

export interface INativeRequestConfig {
  autoShow: boolean;
  backoffDuration: number;
}

class NativeRequest {
  private api: IBatchSDK;
  private conf: INativeRequestConfig;

  public constructor(api: IBatchSDK, config: INativeRequestConfig) {
    this.api = api;

    this.conf = Object.assign(
      {
        autoShow: true,
        backoffDuration: 86400, // 1 day
      },
      config
    );
  }

  public draw(_: ISubscriptionState): void {
    if (this.conf.autoShow) {
      this.show();
    }
  }

  public async show(force: boolean = false): Promise<void> {
    if (window.safari) {
      // There is no "decide later" on safari, so having a cooldown is not needed
      // We also should not call Notification.requestPermission() as it shows a different
      // prompt. So, on Safari, bypass everything and let the SDK deal with it.
      this.api.subscribe();
      return;
    }

    const dismissed = +(window.localStorage.getItem(LSKEY) as string);
    const now = Math.round(new Date().getTime() / 1000);

    if (Notification.permission === Permission.Granted) {
      this.api.subscribe();
    } else if (Notification.permission !== Permission.Denied) {
      if (force || !dismissed || this.conf.backoffDuration === 0 || now - dismissed > this.conf.backoffDuration) {
        const permission = await Notification.requestPermission();
        if (permission) {
          // No matter what the user answered, write the last shown on promise
          window.localStorage.setItem(LSKEY, Math.round(new Date().getTime() / 1000) + "");
          if (permission === Permission.Granted) {
            this.api.subscribe();
          }
        }
      }
    }
  }

  public hide(): void {
    // Stub, we can't hide the browser's UI once triggered
  }

  public reset(): void {
    window.localStorage.removeItem(LSKEY);
  }
}

window.batchSDK(
  "ui.register",
  componentName,
  (api: IBatchSDK, conf: INativeRequestConfig, onDrawnCallback: (component: unknown) => void) => {
    const native = new NativeRequest(api, conf);

    api.on(BatchSDK.SDKEvent.UiReady, (_: unknown, sub: ISubscriptionState) => {
      native.draw(sub);
      onDrawnCallback(native);
    });

    return native;
  }
);
