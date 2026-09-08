import { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import { writeClipboardText } from "com.batch.dom/render/bridge/browser-gateway";
import type { RenderEventAttributes } from "com.batch.dom/render/contracts";
import { MessageRenderer } from "com.batch.dom/render/renderer";
import { ModalSurfaceStrategy } from "com.batch.dom/render/runtime/surface/modal-surface-strategy";
import {
  clipboardAction,
  deeplinkAction,
  dismissAction,
  formSubmitTrackEventAction,
  groupAction,
  requestNotificationsAction,
  trackEventAction,
  userTagAction,
} from "com.batch.shared/actions/builtins";
import { MessageActionExecutor } from "com.batch.shared/actions/executor";

type AnalyticsListener = (event: MessagingEventPayload) => void;
const analyticsListeners = new Set<AnalyticsListener>();

/** Effect ports the registered built-ins delegate to. Spy on these. */
export const testActionGateway = {
  showUIElement: async (_componentName: string, _force?: boolean): Promise<void> => undefined,
  trackEvent: async (_name: string, _attributes?: RenderEventAttributes): Promise<void> => undefined,
  updateUserTag: async (_action: "add" | "remove", _collection: string, _tag: string): Promise<void> => undefined,
};

function makeTestActionExecutor(): MessageActionExecutor {
  const executor = new MessageActionExecutor();
  executor.register("batch.dismiss", dismissAction);
  executor.register("dismiss", dismissAction);
  executor.register("batch.deeplink", deeplinkAction());
  executor.register("batch.clipboard", clipboardAction(writeClipboardText));
  executor.register("batch.group", groupAction(executor));
  executor.register(
    "batch.user.event",
    trackEventAction((name, attributes) => testActionGateway.trackEvent(name, attributes))
  );
  executor.register(
    "batch.user.tag",
    userTagAction((action, collection, tag) => testActionGateway.updateUserTag(action, collection, tag))
  );
  executor.register(
    "batch.request_notifications",
    requestNotificationsAction((component, force) => testActionGateway.showUIElement(component, force))
  );
  executor.register(
    "batch.form.submit",
    formSubmitTrackEventAction((name, attributes) => testActionGateway.trackEvent(name, attributes))
  );
  return executor;
}

export const modalRenderer = new MessageRenderer({
  actions: makeTestActionExecutor(),
  analyticsSink: {
    emit: (event: MessagingEventPayload): void => {
      analyticsListeners.forEach(listener => listener(event));
    },
  },
  surface: new ModalSurfaceStrategy(),
});

export function captureAnalyticsEvents(): { events: MessagingEventPayload[]; unsubscribe: () => void } {
  const events: MessagingEventPayload[] = [];
  const listener: AnalyticsListener = event => events.push(event);
  analyticsListeners.add(listener);
  return {
    events,
    unsubscribe: () => {
      analyticsListeners.delete(listener);
    },
  };
}

export async function flushPromises(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    // Each tick must settle before the next one, so Promise.all would defeat the purpose.
    // oxlint-disable-next-line eslint/no-await-in-loop
    await Promise.resolve();
  }
}

export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

export function getHostShadowRoot(): ShadowRoot {
  const host = document.getElementById("batchsdk-messaging-host");
  if (!(host instanceof HTMLElement) || host.shadowRoot == null) {
    throw new Error("Expected message host with open shadow root");
  }
  return host.shadowRoot;
}
