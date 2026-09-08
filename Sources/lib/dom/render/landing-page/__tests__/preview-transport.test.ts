/* eslint-env jest */

import { Log } from "com.batch.shared/logger";

import { WS_URL } from "../../../../../config";
import { createLandingPreviewTransport, LandingPreviewTransportConfig } from "../preview-transport";

const CONFIG: LandingPreviewTransportConfig = {
  inputEndpoint: `${WS_URL}/lp/input/lp-1`,
  eventData: { tid: "lp-1", is_test: "true" },
};

const SKIPPED_POST = `[LandingPage] preview mode: skipped POST ${CONFIG.inputEndpoint}`;

describe("createLandingPreviewTransport", () => {
  const realFetch = global.fetch;
  const realSendBeacon = navigator.sendBeacon;
  let fetchMock: jest.Mock;
  let sendBeaconMock: jest.Mock;
  let publicLog: jest.SpyInstance;

  function skippedRequests(): unknown[][] {
    return publicLog.mock.calls.filter(
      call => typeof call[0] === "string" && call[0].startsWith("[LandingPage] preview mode: skipped POST")
    );
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    sendBeaconMock = jest.fn();
    global.fetch = fetchMock;
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, writable: true, value: sendBeaconMock });
    publicLog = jest.spyOn(Log, "public").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = realFetch;
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, writable: true, value: realSendBeacon });
    publicLog.mockRestore();
  });

  test("accepts an empty submit", async () => {
    await expect(createLandingPreviewTransport(CONFIG).submitFields({})).resolves.toEqual({ status: "accepted" });
  });

  test("accepts a populated submit", async () => {
    const transport = createLandingPreviewTransport(CONFIG);

    await expect(transport.submitFields({ email: "someone@batch.com", optin: true })).resolves.toEqual({ status: "accepted" });
  });

  test("swallows the engine analytics events", () => {
    const transport = createLandingPreviewTransport(CONFIG);

    expect(() => transport.emitEvent({ type: "displayed" })).not.toThrow();
    expect(() => transport.emitEvent({ type: "clicked", ctaId: "cta-1", ctaType: "button" })).not.toThrow();
  });

  test("never reaches the network, on either flow", async () => {
    const transport = createLandingPreviewTransport(CONFIG);

    await transport.submitFields({ email: "someone@batch.com" });
    transport.emitEvent({ type: "displayed" });
    transport.emitEvent({ type: "clicked", ctaId: "cta-1", ctaType: "button" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  test("logs the submit request it skipped", async () => {
    await createLandingPreviewTransport(CONFIG).submitFields({ $email_address: "someone@batch.com" });

    expect(skippedRequests()).toEqual([
      [
        SKIPPED_POST,
        {
          session_id: expect.any(String),
          events: [
            {
              id: expect.any(String),
              name: "_FORM_SUBMITTED",
              date: expect.any(String),
              params: { ed: CONFIG.eventData, email: "someone@batch.com" },
            },
          ],
        },
      ],
    ]);
  });

  test("logs the analytics request it skipped", () => {
    createLandingPreviewTransport(CONFIG).emitEvent({ type: "clicked", ctaId: "cta-1", ctaType: "button", action: "batch.deeplink" });

    expect(skippedRequests()).toEqual([
      [
        SKIPPED_POST,
        {
          session_id: expect.any(String),
          events: [
            {
              id: expect.any(String),
              name: "_MESSAGING",
              date: expect.any(String),
              params: { ed: CONFIG.eventData, type: "cta_action", ctaId: "cta-1", ctaType: "button", action: "batch.deeplink" },
            },
          ],
        },
      ],
    ]);
  });

  test.each(["dismiss", "close", "auto_close", "close_error"] as const)("logs nothing for the engine lifecycle event %s", type => {
    createLandingPreviewTransport(CONFIG).emitEvent({ type });

    expect(skippedRequests()).toEqual([]);
  });

  test("logs the authored endpoint even when it is not a legitimate target", () => {
    createLandingPreviewTransport({ ...CONFIG, inputEndpoint: "https://evil.example.com/lp/input/lp-1" }).emitEvent({ type: "displayed" });

    expect(skippedRequests()[0][0]).toBe("[LandingPage] preview mode: skipped POST https://evil.example.com/lp/input/lp-1");
  });

  test("keeps one session id across every skipped request", async () => {
    const transport = createLandingPreviewTransport(CONFIG);

    transport.emitEvent({ type: "displayed" });
    await transport.submitFields({ email: "someone@batch.com" });

    const sessionIds = skippedRequests().map(call => (call[1] as { session_id: string }).session_id);
    expect(sessionIds).toHaveLength(2);
    expect(new Set(sessionIds).size).toBe(1);
  });
});
