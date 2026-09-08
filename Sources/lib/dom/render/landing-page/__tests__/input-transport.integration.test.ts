/* eslint-env jest */

import { createLandingInputTransport } from "com.batch.dom/render/landing-page/input-transport";
import { createLandingPageActionExecutor, LandingPageActionsConfig } from "com.batch.dom/render/landing-page/landing-page-actions";
import { LandingPageAnalyticsSink } from "com.batch.dom/render/landing-page/landing-page-analytics-sink";
import { landingDefaultTexts } from "com.batch.dom/render/landing-page/landing-page-l10n";

import { WS_URL } from "../../../../../config";

const INPUT_ENDPOINT = `${WS_URL}/lp/input/lp-42`;
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

function mockFetch(response: unknown, ok = true): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => response });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;
  return fetchMock;
}

describe("landing page action registry (batch.form.submit)", () => {
  const SUBMIT = { action: "batch.form.submit" };
  const EVENT_DATA = { page_id: "lp-42", is_test: "true" };
  const ERROR_PAGE = "https://lp.batch.com/static/error";

  interface ExecutorHarness {
    executor: ReturnType<typeof createLandingPageActionExecutor>;
    showEmbeddedErrorPage: jest.Mock;
    navigate: jest.Mock;
  }

  function makeExecutor(overrides: Partial<LandingPageActionsConfig> = {}): ExecutorHarness {
    const showEmbeddedErrorPage = jest.fn();
    const navigate = jest.fn();
    const executor = createLandingPageActionExecutor({
      transport: createLandingInputTransport({
        inputEndpoint: INPUT_ENDPOINT,
        eventData: EVENT_DATA,
        texts: landingDefaultTexts("en"),
      }),
      showEmbeddedErrorPage,
      navigate,
      ...overrides,
    });
    return { executor, showEmbeddedErrorPage, navigate };
  }

  function mockVerdict(status: "accepted" | "rejected", errors?: Record<string, string>): jest.Mock {
    const fetchMock = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse((init as RequestInit).body as string) as { events: { id: string }[] };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: body.events.map(event => (errors ? { id: event.id, status, errors } : { id: event.id, status })),
        }),
      };
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;
    return fetchMock;
  }

  function submittedEvent(fetchMock: jest.Mock, call = 0): { id: string; name: string; date: string; params: Record<string, unknown> } {
    return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string).events[0];
  }

  afterEach(() => jest.restoreAllMocks());

  test("a submit POSTs a _FORM_SUBMITTED request envelope to the served endpoint", async () => {
    const fetchMock = mockVerdict("accepted");
    const outcome = await makeExecutor().executor.execute(SUBMIT, { formFields: { $email_address: "user@example.com" } });

    expect(outcome).toEqual({ kind: "form-feedback", status: "success" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(INPUT_ENDPOINT);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.session_id).toBe(sessionStorage.getItem("com.batch.lp.sessionId"));
    expect(body.session_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      name: "_FORM_SUBMITTED",
      params: { ed: { page_id: "lp-42", is_test: "true" }, email: "user@example.com" },
    });
    expect(typeof body.events[0].id).toBe("string");
    expect(body.events[0].id.length).toBeGreaterThan(0);
    expect(body.events[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test("an unparseable response keeps the form once, then errors and opens the embedded error page", async () => {
    mockFetch({ unexpected: true });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { executor, showEmbeddedErrorPage, navigate } = makeExecutor();
    const submit = (): Promise<unknown> => executor.execute(SUBMIT, { formFields: { $email_address: "jean@example.com" } });

    await expect(submit()).rejects.toThrow("Could not parse landing page input response");
    expect(showEmbeddedErrorPage).not.toHaveBeenCalled();

    await expect(submit()).resolves.toEqual({ kind: "form-feedback", status: "error" });
    expect(showEmbeddedErrorPage).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  test("a transient failure is retried under the same submission id and still yields the verdict", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.useFakeTimers();
    try {
      const fetchMock = jest
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockImplementation(async (_url: string, init?: RequestInit) => {
          const body = JSON.parse((init as RequestInit).body as string) as { events: { id: string }[] };
          return { ok: true, status: 200, json: async () => ({ results: [{ id: body.events[0].id, status: "accepted" }] }) };
        });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;
      const { executor, showEmbeddedErrorPage } = makeExecutor();

      const pending = executor.execute(SUBMIT, { formFields: { $email_address: "jean@example.com" } });
      // The submit loop spaces its attempts by RETRY_MIN_INTERVAL_MS, which is 1s.
      await jest.advanceTimersByTimeAsync(1100);

      expect(await pending).toEqual({ kind: "form-feedback", status: "success" });
      expect(showEmbeddedErrorPage).not.toHaveBeenCalled();
      const first = submittedEvent(fetchMock, 0);
      const second = submittedEvent(fetchMock, 1);
      expect(second.id).toBe(first.id);
      expect(second.date).toBe(first.date);
    } finally {
      jest.useRealTimers();
    }
  });

  test("a failing analytics batch never spends the submit's retry budget", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.useFakeTimers();
    const originalSendBeacon = navigator.sendBeacon;
    try {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      let submitAttempts = 0;
      const fetchMock = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse((init as RequestInit).body as string) as { events: { id: string; name: string }[] };
        const submit = body.events.find(event => event.name === "_FORM_SUBMITTED");
        if (!submit || (submitAttempts += 1) === 1) {
          throw new Error("offline");
        }
        return { ok: true, status: 200, json: async () => ({ results: [{ id: submit.id, status: "accepted" }] }) };
      });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

      const transport = createLandingInputTransport({
        inputEndpoint: INPUT_ENDPOINT,
        eventData: EVENT_DATA,
        texts: landingDefaultTexts("en"),
      });
      const { executor } = makeExecutor({ transport });
      new LandingPageAnalyticsSink(transport).emit({ type: "displayed" });

      await jest.advanceTimersByTimeAsync(1900);
      const pending = executor.execute(SUBMIT, { formFields: { $email_address: "jean@example.com" } });
      await jest.advanceTimersByTimeAsync(1100);

      await expect(pending).resolves.toEqual({ kind: "form-feedback", status: "success" });
      expect(submitAttempts).toBe(2);
    } finally {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = originalSendBeacon;
      jest.useRealTimers();
    }
  });

  test("a success verdict stays on the page: no navigation, no embedded view, no probe", async () => {
    const fetchMock = mockVerdict("accepted");
    const { executor, showEmbeddedErrorPage, navigate } = makeExecutor({ errorPageEndpoint: ERROR_PAGE });

    await executor.execute(SUBMIT, { formFields: { $email_address: "jean@example.com" } });
    await flush();

    expect(navigate).not.toHaveBeenCalled();
    expect(showEmbeddedErrorPage).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(call => (call[1] as RequestInit | undefined)?.method !== "HEAD")).toBe(true);
  });

  test("an outage lasting past the submit retry budget navigates to the reachable error page", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "HEAD") {
          return Promise.resolve({ ok: true });
        }
        return Promise.reject(new Error("offline"));
      });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;
      const { executor, showEmbeddedErrorPage, navigate } = makeExecutor({ errorPageEndpoint: ERROR_PAGE });
      const submit = (): Promise<unknown> => executor.execute(SUBMIT, { formFields: { $email_address: "jean@example.com" } });

      // 2100ms covers RETRY_MAX_ATTEMPTS attempts spaced by RETRY_MIN_INTERVAL_MS.
      const first = submit();
      await jest.advanceTimersByTimeAsync(2100);
      await expect(first).rejects.toThrow("offline");
      expect(navigate).not.toHaveBeenCalled();

      const second = submit();
      await jest.advanceTimersByTimeAsync(2100);
      await second;

      expect(navigate).toHaveBeenCalledWith(ERROR_PAGE);
      expect(showEmbeddedErrorPage).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("LandingPageAnalyticsSink (EventTracker on the landing transport)", () => {
  const SHOW_EVENT = { type: "displayed" } as const;
  const CLICK_EVENT = { type: "clicked", ctaId: "cta-1", ctaType: "button" } as const;
  const originalSendBeacon = navigator.sendBeacon;

  function makeSink(eventData: Record<string, string> = { page_id: "lp-42" }): LandingPageAnalyticsSink {
    return new LandingPageAnalyticsSink(
      createLandingInputTransport({
        inputEndpoint: INPUT_ENDPOINT,
        eventData,
        texts: landingDefaultTexts("en"),
      })
    );
  }

  afterEach(() => {
    (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = originalSendBeacon;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("a clicked event flushes immediately through the transport (sendBeacon preferred)", () => {
    const beacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: unknown }).sendBeacon = beacon;
    const fetchMock = mockFetch({});

    makeSink().emit(CLICK_EVENT);

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, payload] = beacon.mock.calls[0];
    expect(url).toBe(INPUT_ENDPOINT);
    expect(payload).toBeInstanceOf(Blob);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("falls back to keepalive fetch when sendBeacon is unavailable", () => {
    (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
    const fetchMock = mockFetch({});

    makeSink().emit(CLICK_EVENT);

    expect(fetchMock).toHaveBeenCalledWith(INPUT_ENDPOINT, expect.objectContaining({ method: "POST", keepalive: true }));
  });

  test("muting keeps the events already tracked on their way out", () => {
    jest.useFakeTimers();
    const beacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: unknown }).sendBeacon = beacon;
    const sink = makeSink();

    sink.emit(SHOW_EVENT);
    sink.mute();
    jest.advanceTimersByTime(250);

    expect(beacon).toHaveBeenCalledTimes(1);
  });
});
