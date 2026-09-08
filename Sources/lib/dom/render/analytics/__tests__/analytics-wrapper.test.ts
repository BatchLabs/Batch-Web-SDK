/* eslint-env jest */

import { ctaTypeForComponentId, MessageAnalyticsWrapper, MessageCloseErrorCause } from "com.batch.dom/render/analytics/analytics-wrapper";
import { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { MessagePayload } from "com.batch.dom/render/model/types";

function makeMessage(overrides: Partial<MessagePayload> = {}) {
  const payload: MessagePayload = {
    format: "modal",
    root: {
      children: [],
    },
    closeOptions: {},
    texts: {},
    urls: {},
    actions: {},
    eventData: {
      campaign: "spring_sale",
    },
    trackingId: "  msg-tracking-id  ",
    ...overrides,
  };
  return normalizeMessage(payload);
}

describe("MessageAnalyticsWrapper", () => {
  test("deduplicates one-shot events", () => {
    const events: MessagingEventPayload[] = [];
    const wrapper = new MessageAnalyticsWrapper(makeMessage(), event => events.push(event));

    wrapper.trackDisplayed();
    wrapper.trackDisplayed();
    wrapper.trackDismissed();
    wrapper.trackDismissed();
    wrapper.trackClosed();
    wrapper.trackClosed();
    wrapper.trackAutoClosed();
    wrapper.trackAutoClosed();
    wrapper.trackClicked("cta-1", "button", "openURL");
    wrapper.trackClicked("cta-1", "button", "openURL");
    wrapper.trackCloseError(MessageCloseErrorCause.InvalidResponse);
    wrapper.trackCloseError(MessageCloseErrorCause.InvalidResponse);

    expect(events.map(event => event.type)).toEqual(["displayed", "dismiss", "close", "auto_close", "clicked", "close_error"]);
  });

  test("deduplicates clicks per CTA, not per surface", () => {
    const events: MessagingEventPayload[] = [];
    const wrapper = new MessageAnalyticsWrapper(makeMessage(), event => events.push(event));

    wrapper.trackClicked("cta-1", "button", "openURL");
    wrapper.trackClicked("cta-1", "button", "openURL");
    wrapper.trackClicked("cta-2", "image", "deeplink");

    expect(events.map(event => [event.type, event.ctaId])).toEqual([
      ["clicked", "cta-1"],
      ["clicked", "cta-2"],
    ]);
  });

  test("emits mobile-compatible payload fields", () => {
    const events: MessagingEventPayload[] = [];
    const wrapper = new MessageAnalyticsWrapper(makeMessage(), event => events.push(event));

    wrapper.trackClicked("cta-id", "button", "openURL");
    wrapper.trackCloseError(MessageCloseErrorCause.ClientNetwork);

    expect(events[0]).toEqual({
      id: "msg-tracking-id",
      ed: { campaign: "spring_sale" },
      type: "clicked",
      ctaId: "cta-id",
      ctaType: "button",
      action: "openURL",
    });

    expect(events[1]).toEqual({
      id: "msg-tracking-id",
      ed: { campaign: "spring_sale" },
      type: "close_error",
      cause: MessageCloseErrorCause.ClientNetwork,
    });
  });

  test("resolves cta type by component id", () => {
    const message = makeMessage({
      format: "modal",
      root: {
        children: [
          {
            type: "button",
            id: "button-id",
            backgroundColor: ["#FFFFFFFF"],
            textColor: ["#000000FF"],
            fontSize: 14,
          },
          {
            type: "image",
            id: "image-id",
            height: "120px",
          },
        ],
      },
      urls: {
        "image-id": "https://image.example.test/banner.png",
      },
    });

    expect(ctaTypeForComponentId(message, "button-id")).toBe("button");
    expect(ctaTypeForComponentId(message, "image-id")).toBe("image");
    expect(ctaTypeForComponentId(message, "unknown-id")).toBe("button");
  });

  test("reports a string CTA value verbatim, whitespace included", () => {
    const events: MessagingEventPayload[] = [];
    const wrapper = new MessageAnalyticsWrapper(makeMessage(), event => events.push(event));

    wrapper.trackClicked("cta-1", "button", "batch.clipboard", "  PROMO 2024  ");
    wrapper.trackClicked("cta-2", "button", "batch.clipboard", "   ");

    expect(events.map(event => event.value)).toEqual(["  PROMO 2024  ", "   "]);
  });
});
