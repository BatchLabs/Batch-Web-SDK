/* eslint-env jest */

import type { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import type { MessagePayload } from "com.batch.dom/render/model/types";
import { MessageRenderer } from "com.batch.dom/render/renderer";
import { ModalSurfaceStrategy } from "com.batch.dom/render/runtime/surface/modal-surface-strategy";
import { MessageActionExecutor } from "com.batch.shared/actions/executor";

import { makeModalPayload } from "../../test-utils/factories/renderer-payloads";

const stubActions = new MessageActionExecutor();

function makeRenderer(events: MessagingEventPayload[]): MessageRenderer {
  return new MessageRenderer({
    actions: stubActions,
    analyticsSink: { emit: (event: MessagingEventPayload): void => void events.push(event) },
    surface: new ModalSurfaceStrategy(),
  });
}

describe("renderer format validation", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("a payload carrying a removed format rejects before any host is attached", async () => {
    const events: MessagingEventPayload[] = [];
    const renderer = makeRenderer(events);

    const payload = { ...makeModalPayload(), format: "webview" } as unknown as MessagePayload;

    await expect(renderer.show(payload)).rejects.toThrow('Invalid Message payload: unsupported format "webview"');
    expect(document.getElementById("batchsdk-messaging-host")).toBeNull();
    expect(events).toEqual([]);
  });

  test("an unknown format rejects with the runtime value it received", async () => {
    const events: MessagingEventPayload[] = [];
    const renderer = makeRenderer(events);
    const payload = { ...makeModalPayload(), format: undefined } as unknown as MessagePayload;

    await expect(renderer.show(payload)).rejects.toThrow('Invalid Message payload: unsupported format "undefined"');
    expect(document.getElementById("batchsdk-messaging-host")).toBeNull();
    expect(events).toEqual([]);
  });

  test("a supported format still renders and reports displayed", async () => {
    const events: MessagingEventPayload[] = [];
    const renderer = makeRenderer(events);

    await renderer.show(makeModalPayload());

    expect(document.getElementById("batchsdk-messaging-host")).not.toBeNull();
    expect(events.map(event => event.type)).toEqual(["displayed"]);

    renderer.hide();
  });
});
