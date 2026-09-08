/* eslint-env jest */

import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import BaseWebservice from "com.batch.shared/webservice/base";
import { EventTrackerService } from "com.batch.shared/webservice/event-tracker";
import HttpError from "com.batch.shared/webservice/http-error";

import { RETRY_MAX_ATTEMPTS } from "../../../../../config";
import { FormSubmittedEvent, LandingInputRequestBody, LandingPageEvent, MessagingEvent } from "../input-contract";
import { ATTEMPT_TIMEOUT_MS, InputEndpointExecutor } from "../input-endpoint-executor";

const ENDPOINT = "https://ws.batch.com/lp/input/lp-42";
const SESSION_ID = "6f1c8e2a-0001-4a1b-9c3d-000000000099";

function makeWebservice(events: LandingPageEvent[]): EventTrackerService {
  return new EventTrackerService(events.map(event => ({ id: event.id, name: event.name, toJSON: () => event })));
}

const fetchHost = globalThis as { fetch: typeof fetch };

function installFetchMock(mock: jest.Mock): jest.Mock {
  fetchHost.fetch = mock;
  return mock;
}

function mockFetch(response: unknown, status = 200): jest.Mock {
  return installFetchMock(jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => response }));
}

function mockHangingFetch(): jest.Mock {
  return installFetchMock(
    jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("AbortError: the request was aborted")));
        })
    )
  );
}

function mockPendingBodyFetch(): { fetchMock: jest.Mock; wasAborted: () => boolean } {
  let wasAborted = false;
  const stalledResponse = { ok: true, status: 200, json: () => new Promise<unknown>(() => undefined) } as unknown as Response;
  const fetchMock = installFetchMock(
    jest.fn((_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => {
        wasAborted = true;
      });
      return Promise.resolve(stalledResponse);
    })
  );
  return { fetchMock, wasAborted: () => wasAborted };
}

function mockFailedStatusPendingBodyFetch(status: number): jest.Mock {
  const stalledResponse = { ok: false, status, json: () => new Promise<unknown>(() => undefined) } as unknown as Response;
  return installFetchMock(jest.fn(() => Promise.resolve(stalledResponse)));
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function postedBodies(fetchMock: jest.Mock): string[] {
  return fetchMock.mock.calls.map(call => (call[1] as RequestInit).body as string);
}

describe("InputEndpointExecutor", () => {
  const originalSendBeacon = navigator.sendBeacon;

  afterEach(() => {
    (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = originalSendBeacon;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("analytics batches", () => {
    test("never calls getBody/getHeaders — the ids block does not exist on landing pages", async () => {
      (navigator as unknown as { sendBeacon: unknown }).sendBeacon = jest.fn().mockReturnValue(true);
      const ws = makeWebservice([]);
      const getBody = jest.spyOn(ws, "getBody");
      const getHeaders = jest.spyOn(ws, "getHeaders");

      await new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(ws);

      expect(getBody).not.toHaveBeenCalled();
      expect(getHeaders).not.toHaveBeenCalled();
    });

    test("refuses a webservice that is not an event batch: nothing else runs on this transport", async () => {
      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(new BaseWebservice())).rejects.toThrow(
        "only accepts EventTrackerService batches"
      );
    });

    test("body is the request envelope { session_id, events }, posted to the served endpoint as-is", async () => {
      const beacon = jest.fn().mockReturnValue(true);
      (navigator as unknown as { sendBeacon: unknown }).sendBeacon = beacon;
      const serializedEvent: MessagingEvent = {
        id: "uuid-1",
        name: InternalSDKEvent.Messaging,
        date: "2026-07-24T10:00:00.000Z",
        params: { ed: {}, type: "show" },
      };
      const ws = makeWebservice([serializedEvent]);

      await new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(ws);

      expect(beacon.mock.calls[0][0]).toBe(ENDPOINT);
      const blob = beacon.mock.calls[0][1] as Blob;
      const body = JSON.parse(await blobText(blob)) as LandingInputRequestBody;
      expect(body).toEqual({ session_id: SESSION_ID, events: [serializedEvent] });
    });

    test("falls back to a keepalive fetch when sendBeacon refuses the payload", async () => {
      (navigator as unknown as { sendBeacon: unknown }).sendBeacon = jest.fn().mockReturnValue(false);
      const fetchMock = mockFetch({ results: [] });

      await new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(makeWebservice([]));

      // fetch keepalive caps the body at 64 KiB, which only analytics accepts.
      expect(fetchMock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({ method: "POST", keepalive: true, credentials: "omit", redirect: "error" })
      );
    });

    test("an HTTP success is delivery: the analytics body is never read", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const json = jest.fn();
      installFetchMock(jest.fn().mockResolvedValue({ ok: true, status: 200, json }));

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(makeWebservice([]))).resolves.toBeUndefined();

      expect(json).not.toHaveBeenCalled();
    });

    test.each([404, 429, 500, 503])("rejects with an HttpError on HTTP %i so the tracker retries", async status => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      mockFetch({}, status);

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(makeWebservice([]))).rejects.toThrow(HttpError);
    });

    test.each([400, 413])("resolves on HTTP %i so the tracker purges the malformed batch instead of retrying", async status => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      mockFetch({}, status);

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(makeWebservice([]))).resolves.toEqual({});
    });

    test("rejects on a network error so the tracker retries", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      installFetchMock(jest.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(makeWebservice([]))).rejects.toThrow("Failed to fetch");
    });
  });

  describe("awaited submit", () => {
    const SUBMIT_EVENT: FormSubmittedEvent = {
      id: "submit-1",
      name: InternalSDKEvent.FormSubmitted,
      date: "2026-07-24T10:00:00.000Z",
      params: { ed: {}, email: "jane@example.com" },
    };

    test("posts the envelope itself and resolves with the verdict for its event", async () => {
      const beacon = jest.fn().mockReturnValue(true);
      (navigator as unknown as { sendBeacon: unknown }).sendBeacon = beacon;
      const fetchMock = mockFetch({ results: [{ id: "submit-1", status: "accepted" }] });

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).resolves.toEqual({
        id: "submit-1",
        status: "accepted",
      });

      expect(beacon).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(postedBodies(fetchMock)[0])).toEqual({ session_id: SESSION_ID, events: [SUBMIT_EVENT] });
    });

    test("refuses to follow a redirect and does not inherit the keepalive body cap", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const fetchMock = mockFetch({ results: [{ id: "submit-1", status: "accepted" }] });

      await new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT);

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.redirect).toBe("error");
      expect(init.credentials).toBe("omit");
      expect(init).not.toHaveProperty("keepalive");
      expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT);
    });

    test("resolves a rejected verdict, errors included: only the caller judges it", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      mockFetch({ results: [{ id: "submit-1", status: "rejected", errors: { email: "invalid_email" } }] });

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).resolves.toEqual({
        id: "submit-1",
        status: "rejected",
        errors: { email: "invalid_email" },
      });
    });

    test("picks its own verdict out of a response that answers several ids", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      mockFetch({
        results: [
          { id: "someone-else", status: "accepted" },
          { id: "submit-1", status: "rejected", errors: { email: "invalid_email" } },
        ],
      });

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).resolves.toEqual({
        id: "submit-1",
        status: "rejected",
        errors: { email: "invalid_email" },
      });
    });

    test("rejects when the response carries no verdict for this event", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const fetchMock = mockFetch({ results: [{ id: "someone-else", status: "accepted" }] });

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).rejects.toThrow(
        "carries no verdict for event submit-1"
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("rejects when the response body is not the input contract", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const fetchMock = mockFetch({ outcome: "success" });

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).rejects.toThrow(
        "Could not parse landing page input response"
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("rejects without a retry when the body of a 2xx cannot be read", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const fetchMock = installFetchMock(
        jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => Promise.reject(new Error("Unexpected token")) })
      );

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).rejects.toThrow("Unexpected token");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test.each([400, 413])("rejects immediately on HTTP %i: a malformed batch always fails the same way", async status => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const fetchMock = mockFetch({}, status);

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).rejects.toThrow(
        `Input batch rejected: HTTP ${status}`
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("retries a retryable status and resolves on the attempt that finally answers", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const failure = { ok: false, status: 503, json: async () => ({}) };
      const success = { ok: true, status: 200, json: async () => ({ results: [{ id: "submit-1", status: "accepted" }] }) };
      const fetchMock = installFetchMock(
        jest.fn().mockResolvedValueOnce(failure).mockResolvedValueOnce(failure).mockResolvedValue(success)
      );

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).resolves.toEqual({
        id: "submit-1",
        status: "accepted",
      });

      const bodies = postedBodies(fetchMock);
      expect(bodies).toHaveLength(RETRY_MAX_ATTEMPTS);
      expect(new Set(bodies).size).toBe(1);
      expect(JSON.parse(bodies[0])).toEqual({ session_id: SESSION_ID, events: [SUBMIT_EVENT] });
    });

    test("stops at the attempt budget when the status stays retryable", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const fetchMock = mockFetch({}, 503);

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).rejects.toThrow(
        "Landing page input request failed: HTTP 503"
      );
      expect(fetchMock).toHaveBeenCalledTimes(RETRY_MAX_ATTEMPTS);
    });

    test("stops at the attempt budget when the network keeps failing", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      const fetchMock = installFetchMock(jest.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT)).rejects.toThrow("Failed to fetch");
      expect(fetchMock).toHaveBeenCalledTimes(RETRY_MAX_ATTEMPTS);
    });

    test("a request that never answers is aborted, and the freed attempt lets the next one answer", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      jest.useFakeTimers();
      const fetchMock = mockHangingFetch();
      const pending = new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT);

      await jest.advanceTimersByTimeAsync(ATTEMPT_TIMEOUT_MS);
      expect(fetchMock.mock.calls[0][1]).toHaveProperty("signal");

      mockFetch({ results: [{ id: "submit-1", status: "accepted" }] });
      await jest.runOnlyPendingTimersAsync();

      await expect(pending).resolves.toEqual({ id: "submit-1", status: "accepted" });
    });

    test("a response whose body never settles is aborted, and the submit retries", async () => {
      (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
      jest.useFakeTimers();
      const { wasAborted } = mockPendingBodyFetch();
      const pending = new InputEndpointExecutor(ENDPOINT, SESSION_ID).submit(SUBMIT_EVENT);

      await Promise.resolve();
      await Promise.resolve();
      expect(wasAborted()).toBe(false);

      await jest.advanceTimersByTimeAsync(ATTEMPT_TIMEOUT_MS);
      expect(wasAborted()).toBe(true);

      mockFetch({ results: [{ id: "submit-1", status: "accepted" }] });
      await jest.runOnlyPendingTimersAsync();

      await expect(pending).resolves.toEqual({ id: "submit-1", status: "accepted" });
    });
  });

  test("a failed status decides the attempt without reading the body, which may never settle", async () => {
    (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
    mockFailedStatusPendingBodyFetch(503);

    await expect(new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(makeWebservice([]))).rejects.toThrow(HttpError);
  });

  test("posts the wire envelope as JSON, without cookies", async () => {
    (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
    const fetchMock = mockFetch({});

    await new InputEndpointExecutor(ENDPOINT, SESSION_ID).start(makeWebservice([]));

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.credentials).toBe("omit");
  });
});
