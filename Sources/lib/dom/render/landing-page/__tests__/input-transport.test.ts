/* eslint-env jest */

import { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import { RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR } from "com.batch.dom/render/render-constants";
import EventTracker from "com.batch.shared/event/event-tracker";
import { ISerializableEvent } from "com.batch.shared/event/serializable-event";
import { Log } from "com.batch.shared/logger";

import { WS_URL } from "../../../../../config";
import { FormSubmittedEvent, InputEventResult } from "../input-contract";
import { InputEndpointExecutor } from "../input-endpoint-executor";
import { createLandingInputTransport } from "../input-transport";
import { landingDefaultTexts } from "../landing-page-l10n";
import type { LandingTransport } from "../landing-transport";

const INPUT_ENDPOINT = `${WS_URL}/lp/input/lp-42`;
const EVENT_DATA = { trid: "orch_7788_step2", is_test: "false" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function harness(texts: Readonly<Record<string, string>> = landingDefaultTexts("fr")): {
  transport: LandingTransport;
  track: jest.Mock;
  flush: jest.Mock;
  submit: jest.Mock;
  submittedEvent: (call: number) => FormSubmittedEvent;
  resolveVerdict: (result: Omit<InputEventResult, "id">) => void;
  rejectVerdict: (reason: Error) => void;
} {
  const track = jest.fn();
  const flush = jest.fn();
  jest.spyOn(EventTracker.prototype, "track").mockImplementation(track);
  jest.spyOn(EventTracker.prototype, "flush").mockImplementation(flush);

  let settle: ((result: InputEventResult) => void) | undefined;
  let fail: ((reason: Error) => void) | undefined;
  const submit = jest.fn(
    (event: FormSubmittedEvent) =>
      new Promise<InputEventResult>((resolve, reject) => {
        settle = result => resolve({ ...result, id: event.id });
        fail = reject;
      })
  );
  jest.spyOn(InputEndpointExecutor.prototype, "submit").mockImplementation(submit);

  const transport = createLandingInputTransport({ inputEndpoint: INPUT_ENDPOINT, eventData: EVENT_DATA, texts });
  if (!transport) {
    throw new Error(`the harness endpoint ${INPUT_ENDPOINT} must clear the origin gate`);
  }

  return {
    transport,
    track,
    flush,
    submit,
    submittedEvent: call => submit.mock.calls[call][0],
    resolveVerdict: result => settle?.(result as InputEventResult),
    rejectVerdict: reason => fail?.(reason),
  };
}

function serializedEventOf(tracked: ISerializableEvent): { id: string; name: string; date: string; params: Record<string, unknown> } {
  return JSON.parse(JSON.stringify(tracked));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("createLandingInputTransport — submit payload", () => {
  test("submits a _FORM_SUBMITTED event in its native shape, outside the analytics tracker", async () => {
    const h = harness();

    const verdict = h.transport.submitFields({ $email_address: "jean@example.com", consent_d4e5f6: true, topics_g7h8i9: ["a", "b"] });
    h.resolveVerdict({ status: "accepted" });
    await expect(verdict).resolves.toEqual({ status: "accepted" });

    expect(h.submit).toHaveBeenCalledTimes(1);
    const event = h.submittedEvent(0);
    expect(event.name).toBe("_FORM_SUBMITTED");
    expect(event.id).toMatch(UUID_PATTERN);
    expect(event.date).toMatch(ISO_DATE_PATTERN);
    expect(event.params).toEqual({
      ed: EVENT_DATA,
      email: "jean@example.com",
      custom_attributes: { "consent_d4e5f6.b": true, "topics_g7h8i9.a": ["a", "b"] },
    });
    expect(h.track).not.toHaveBeenCalled();
    expect(h.flush).not.toHaveBeenCalled();
  });

  test("a rejected verdict maps FieldErrorCodes to localized messages", async () => {
    const h = harness();

    const verdict = h.transport.submitFields({ $email_address: "jean@example.com" });
    h.resolveVerdict({ status: "rejected", errors: { email: "invalid_email", extra: "brand_new_code" } });

    await expect(verdict).resolves.toEqual({
      status: "rejected",
      fieldErrors: {
        email: "Veuillez saisir une adresse e-mail valide.",
        extra: "Cette valeur est invalide.",
      },
    });
  });

  test("serving text overrides win over the embedded l10n for server errors", async () => {
    const h = harness({ ...landingDefaultTexts("fr"), [RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR]: "Email invalide !" });

    const verdict = h.transport.submitFields({ $email_address: "jean@example.com" });
    h.resolveVerdict({ status: "rejected", errors: { email: "invalid_email" } });

    await expect(verdict).resolves.toMatchObject({ fieldErrors: { email: "Email invalide !" } });
  });

  test("a verdict rotates the submission id: the next submit is a new logical submission", async () => {
    const h = harness();

    const first = h.transport.submitFields({ $email_address: "jean@example.com" });
    h.resolveVerdict({ status: "rejected", errors: { email: "invalid_email" } });
    await first;

    const second = h.transport.submitFields({ $email_address: "marie@example.com" });
    h.resolveVerdict({ status: "rejected", errors: { email: "invalid_email" } });
    await second;

    expect(h.submittedEvent(1).id).not.toBe(h.submittedEvent(0).id);
  });

  test("no verdict keeps the submission id so a user retry dedupes server-side", async () => {
    const h = harness();

    const first = h.transport.submitFields({ $email_address: "a@b.c" });
    h.rejectVerdict(new Error("No verdict"));
    await expect(first).rejects.toThrow("No verdict");

    const second = h.transport.submitFields({ $email_address: "a@b.c" });
    h.resolveVerdict({ status: "accepted" });
    await second;

    expect(h.submittedEvent(1).id).toBe(h.submittedEvent(0).id);
  });

  test("no verdict but corrected values start a new submission", async () => {
    const h = harness();

    const first = h.transport.submitFields({ $email_address: "jean@example.com" });
    h.rejectVerdict(new Error("No verdict"));
    await expect(first).rejects.toThrow("No verdict");

    const second = h.transport.submitFields({ $email_address: "marie@example.com" });
    h.resolveVerdict({ status: "accepted" });
    await second;

    expect(h.submittedEvent(1).id).not.toBe(h.submittedEvent(0).id);
    expect(h.submittedEvent(1).params.email).toBe("marie@example.com");
  });

  test("dates a submit at the submit, not at the page display", async () => {
    jest.useFakeTimers({ now: new Date("2026-08-28T09:00:00.000Z") });
    try {
      const h = harness();
      jest.setSystemTime(new Date("2026-08-28T09:04:30.000Z"));

      const verdict = h.transport.submitFields({ $email_address: "jean@example.com" });
      h.resolveVerdict({ status: "accepted" });
      await verdict;

      expect(h.submittedEvent(0).date).toBe("2026-08-28T09:04:30.000Z");
    } finally {
      jest.useRealTimers();
    }
  });

  test("no verdict keeps the submission date, so a retry stays one submission server-side", async () => {
    jest.useFakeTimers({ now: new Date("2026-08-28T09:00:00.000Z") });
    try {
      const h = harness();

      const first = h.transport.submitFields({ $email_address: "a@b.c" });
      h.rejectVerdict(new Error("No verdict"));
      await expect(first).rejects.toThrow("No verdict");

      jest.setSystemTime(new Date("2026-08-28T09:00:20.000Z"));
      const second = h.transport.submitFields({ $email_address: "a@b.c" });
      h.resolveVerdict({ status: "accepted" });
      await second;

      expect(h.submittedEvent(1).date).toBe("2026-08-28T09:00:00.000Z");
    } finally {
      jest.useRealTimers();
    }
  });

  test("a verdict rotates the submission date too: a corrected re-submit carries its own", async () => {
    jest.useFakeTimers({ now: new Date("2026-08-28T09:00:00.000Z") });
    try {
      const h = harness();

      const first = h.transport.submitFields({ $email_address: "jean@example.com" });
      h.resolveVerdict({ status: "rejected", errors: { email: "invalid_email" } });
      await first;

      jest.setSystemTime(new Date("2026-08-28T09:01:15.000Z"));
      const second = h.transport.submitFields({ $email_address: "jean@example.com" });
      h.resolveVerdict({ status: "accepted" });
      await second;

      expect(h.submittedEvent(0).date).toBe("2026-08-28T09:00:00.000Z");
      expect(h.submittedEvent(1).date).toBe("2026-08-28T09:01:15.000Z");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("createLandingInputTransport — analytics payload", () => {
  test("serializes displayed as a _MESSAGING show event without flushing", () => {
    const h = harness();
    h.transport.emitEvent({ type: "displayed" });

    const serializedEvent = serializedEventOf(h.track.mock.calls[0][0]);
    expect(serializedEvent.name).toBe("_MESSAGING");
    expect(serializedEvent.id).toMatch(UUID_PATTERN);
    expect(serializedEvent.date).toMatch(ISO_DATE_PATTERN);
    expect(serializedEvent.params).toEqual({ ed: EVENT_DATA, type: "show" });
    expect(h.flush).not.toHaveBeenCalled();
  });

  test("serializes clicked as a cta_action event with the action verbatim and flushes", () => {
    const h = harness();
    const clicked: MessagingEventPayload = { type: "clicked", ctaId: "cta-1", ctaType: "button", action: "batch.deeplink" };
    h.transport.emitEvent(clicked);

    expect(serializedEventOf(h.track.mock.calls[0][0]).params).toEqual({
      ed: EVENT_DATA,
      type: "cta_action",
      ctaId: "cta-1",
      ctaType: "button",
      action: "batch.deeplink",
    });
    expect(h.flush).toHaveBeenCalledTimes(1);
  });

  test("flushes on a submit click too: analytics and submits no longer share a tracker", () => {
    const h = harness();
    h.transport.emitEvent({ type: "clicked", ctaId: "submit_button", ctaType: "button", action: "batch.form.submit" });

    expect(h.track).toHaveBeenCalledTimes(1);
    expect(h.flush).toHaveBeenCalledTimes(1);
  });

  test("captures the date at emission, not at serialization", () => {
    jest.useFakeTimers({ now: new Date("2026-07-24T10:00:00.000Z") });
    try {
      const h = harness();
      h.transport.emitEvent({ type: "displayed" });

      jest.setSystemTime(new Date("2026-07-24T10:05:00.000Z"));
      expect(serializedEventOf(h.track.mock.calls[0][0]).date).toBe("2026-07-24T10:00:00.000Z");
    } finally {
      jest.useRealTimers();
    }
  });

  test("each tracked event gets its own dedup id", () => {
    const h = harness();
    h.transport.emitEvent({ type: "displayed" });
    h.transport.emitEvent({ type: "clicked", ctaId: "cta-1", ctaType: "button" });

    expect(serializedEventOf(h.track.mock.calls[0][0]).id).not.toBe(serializedEventOf(h.track.mock.calls[1][0]).id);
  });

  describe("flushes what is still buffered when the visit ends", () => {
    test("pagehide flushes: a fast bounce would otherwise take the show with it", () => {
      const h = harness();
      h.transport.emitEvent({ type: "displayed" });
      expect(h.flush).not.toHaveBeenCalled();

      window.dispatchEvent(new Event("pagehide"));

      expect(h.flush).toHaveBeenCalled();
    });

    test("visibilitychange flushes only once hidden: a throttled tab can be discarded without a pagehide", () => {
      const h = harness();
      h.transport.emitEvent({ type: "displayed" });
      const visibility = (state: DocumentVisibilityState): void => {
        Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
      };

      visibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      expect(h.flush).not.toHaveBeenCalled();

      visibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      expect(h.flush).toHaveBeenCalled();
    });
  });
});

describe("createLandingInputTransport — endpoint gate", () => {
  const build = (inputEndpoint: string): LandingTransport | undefined =>
    createLandingInputTransport({ inputEndpoint, eventData: EVENT_DATA, texts: landingDefaultTexts("fr") });

  test.each([
    ["a third-party collector", "https://evil.tld/collect"],
    ["a javascript: URL", "javascript:fetch('//evil.tld')"],
    ["a data: URL", "data:text/plain,x"],
  ])("builds no transport for %s", (_label, endpoint) => {
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

    expect(build(endpoint)).toBeUndefined();
    expect(publicError).toHaveBeenCalledWith(expect.stringContaining(endpoint));
  });

  test.each([
    ["the Batch backend origin", INPUT_ENDPOINT],
    ["the page's own origin", `${location.origin}/lp/input/lp-42`],
    ["a relative endpoint", "/lp/input/lp-42"],
  ])("builds a transport for %s", (_label, endpoint) => {
    expect(build(endpoint)).toBeDefined();
  });
});
