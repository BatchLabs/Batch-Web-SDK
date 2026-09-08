import { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import { MessagePayload } from "com.batch.dom/render/model/types";
import { MessageRenderer } from "com.batch.dom/render/renderer";
import { loadMessageFont, unloadMessageFonts } from "com.batch.dom/render/runtime/font-loader";
import { MessageFontConfig } from "com.batch.dom/render/runtime/font-manager";
import { ModalSurfaceStrategy } from "com.batch.dom/render/runtime/surface/modal-surface-strategy";
import { Log } from "com.batch.shared/logger";

import { BatchSDK } from "../types/public-api";
import { createCoreActionExecutorFromApi } from "./core-actions";
import { BatchWindow } from "./ui/sdk";

const logModuleName = "demo-api";
const analyticsLogModule = "MessagingAnalytics";

type DemoActionHandler = (args: Record<string, unknown>) => void | Promise<void>;

const ready: Promise<void> = new Promise<void>(resolve => {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    resolve();
  } else {
    window.addEventListener("DOMContentLoaded", () => resolve(), true);
  }
});

export function attachDemoApi(api: BatchSDK.IPublicAPI): void {
  let requestGeneration = 0;
  let fontGeneration = 0;

  const actions = createCoreActionExecutorFromApi(api);

  const renderer = new MessageRenderer({
    actions,
    analyticsSink: {
      emit: (event: MessagingEventPayload): void => {
        // Send the engine events to the demo log tab and analytics feed.
        Log.info(analyticsLogModule, event.type, event);
        window.dispatchEvent(new CustomEvent("batchmessaging:analytics", { detail: event }));
      },
    },
    surface: new ModalSurfaceStrategy(),
  });

  const demoApi = {
    messaging: {
      display(payload: unknown): Promise<void> {
        const generation = ++requestGeneration;
        // The renderer accepts decoded payload objects only.
        if (typeof payload === "string") {
          return Promise.reject(new Error("Demo renderer expects a decoded message payload"));
        }
        return ready.then(() => {
          if (generation !== requestGeneration) {
            return;
          }
          return renderer.show(payload as MessagePayload);
        });
      },

      hide(): void {
        requestGeneration++;
        renderer.hide();
      },

      setTheme(mode: "auto" | "light" | "dark"): void {
        renderer.setTheme(mode);
      },

      async setFont(config: MessageFontConfig | null): Promise<void> {
        const generation = ++fontGeneration;
        if (config === null) {
          unloadMessageFonts();
          renderer.setFontFamily(null);
          return;
        }
        const family = await loadMessageFont(config);
        // A clear or a newer font landed while this one was loading, so that family already won.
        if (generation === fontGeneration) {
          renderer.setFontFamily(family);
        }
      },

      registerAction(name: string, handler: DemoActionHandler): void {
        renderer.registerAction(name, async args => {
          try {
            await handler(args);
          } catch (error) {
            Log.warn(logModuleName, "Demo action handler failed", error);
          }
          return { kind: "dismiss" };
        });
      },

      unregisterAction(name: string): void {
        renderer.unregisterAction(name);
      },
    },
  };

  Object.defineProperty(api, "__demo", {
    configurable: false,
    enumerable: false,
    value: demoApi,
    writable: false,
  });
}

type ReadyCallback = (api: BatchSDK.IPublicAPI) => void;

// Presence marker for the demo shell: set on evaluation, before `__demo` reaches the API.
(window as unknown as { __batchDemoApiLoaded?: boolean }).__batchDemoApiLoaded = true;

const batchSDK = (window as unknown as BatchWindow).batchSDK as unknown as (callback: ReadyCallback) => void;
batchSDK(api => attachDemoApi(api));
