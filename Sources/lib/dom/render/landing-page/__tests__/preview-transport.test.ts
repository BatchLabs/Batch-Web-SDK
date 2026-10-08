/* eslint-env jest */

import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { WS_URL } from "../../../../../config";
import type { LandingInputRequestBody } from "../input-contract";
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

    await expect(
      transport.submitFields({
        email: { type: ProfileAttributeType.STRING, value: "someone@batch.com" },
        optin: { type: ProfileAttributeType.BOOLEAN, value: true },
      })
    ).resolves.toEqual({ status: "accepted" });
  });

  test("swallows the engine analytics events", () => {
    const transport = createLandingPreviewTransport(CONFIG);

    expect(() => transport.emitEvent({ type: "displayed" })).not.toThrow();
    expect(() => transport.emitEvent({ type: "clicked", ctaId: "cta-1", ctaType: "button" })).not.toThrow();
  });

  test("never reaches the network, on either flow", async () => {
    const transport = createLandingPreviewTransport(CONFIG);

    await transport.submitFields({ email: { type: ProfileAttributeType.STRING, value: "someone@batch.com" } });
    transport.emitEvent({ type: "displayed" });
    transport.emitEvent({ type: "clicked", ctaId: "cta-1", ctaType: "button" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  test("logs the submit request it skipped", async () => {
    await createLandingPreviewTransport(CONFIG).submitFields({
      $email_address: { type: ProfileAttributeType.STRING, value: "someone@batch.com" },
    });

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

  test("preview mints a new event id per submit: nothing to dedupe server-side", async () => {
    const transport = createLandingPreviewTransport(CONFIG);

    await transport.submitFields({ email: { type: ProfileAttributeType.STRING, value: "someone@batch.com" } });
    await transport.submitFields({ email: { type: ProfileAttributeType.STRING, value: "someone@batch.com" } });

    // The logged payloads are the bodies the transport built; `Log.public` only widened them to `unknown`.
    const bodies = skippedRequests().map(call => call[1]) as LandingInputRequestBody[];
    const ids = bodies.map(body => body.events[0].id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  test("preview applies the wire rules: a refused value is missing from the logged body", async () => {
    await expect(
      createLandingPreviewTransport(CONFIG).submitFields({ bad: { type: ProfileAttributeType.STRING, value: "" } })
    ).resolves.toEqual({ status: "accepted" });

    expect(skippedRequests()).toEqual([
      [
        SKIPPED_POST,
        {
          session_id: expect.any(String),
          events: [{ id: expect.any(String), name: "_FORM_SUBMITTED", date: expect.any(String), params: { ed: CONFIG.eventData } }],
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
    await transport.submitFields({ email: { type: ProfileAttributeType.STRING, value: "someone@batch.com" } });

    const sessionIds = skippedRequests().map(call => (call[1] as { session_id: string }).session_id);
    expect(sessionIds).toHaveLength(2);
    expect(new Set(sessionIds).size).toBe(1);
  });
});
