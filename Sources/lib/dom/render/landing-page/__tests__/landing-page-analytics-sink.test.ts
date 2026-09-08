/* eslint-env jest */

import { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";

import { LandingPageAnalyticsSink } from "../landing-page-analytics-sink";
import type { LandingTransport } from "../landing-transport";

function makeTransport(): { transport: LandingTransport; emitEvent: jest.Mock } {
  const emitEvent = jest.fn();
  return { transport: { submitFields: jest.fn(), emitEvent }, emitEvent };
}

describe("LandingPageAnalyticsSink", () => {
  test("forwards displayed and clicked to the transport, verbatim", () => {
    const { transport, emitEvent } = makeTransport();
    const clicked: MessagingEventPayload = { type: "clicked", ctaId: "cta-1", ctaType: "button", action: "deeplink" };
    const sink = new LandingPageAnalyticsSink(transport);

    sink.emit({ type: "displayed" });
    sink.emit(clicked);

    expect(emitEvent.mock.calls.map(call => call[0])).toEqual([{ type: "displayed" }, clicked]);
  });

  test.each(["dismiss", "close", "auto_close", "close_error"] as const)("filters out the engine lifecycle event %s", type => {
    const { transport, emitEvent } = makeTransport();
    new LandingPageAnalyticsSink(transport).emit({ type });
    expect(emitEvent).not.toHaveBeenCalled();
  });

  test("emits nothing once muted (bundled outcome views are not campaign content)", () => {
    const { transport, emitEvent } = makeTransport();
    const sink = new LandingPageAnalyticsSink(transport);

    sink.mute();
    sink.emit({ type: "displayed" });
    sink.emit({ type: "clicked", ctaId: "cta-1", ctaType: "button" });

    expect(emitEvent).not.toHaveBeenCalled();
  });

  test("is inert without a transport: a landing page still renders and clicks", () => {
    const sink = new LandingPageAnalyticsSink();
    expect(() => sink.emit({ type: "displayed" })).not.toThrow();
  });
});
