import { Delay } from "com.batch.shared/helpers/timed-promise";
import { Log } from "com.batch.shared/logger";
import { IWebservice } from "com.batch.shared/webservice/base";
import { EventTrackerService } from "com.batch.shared/webservice/event-tracker";
import { IWebserviceExecutor } from "com.batch.shared/webservice/executor";
import HttpError from "com.batch.shared/webservice/http-error";

import { RETRY_MAX_ATTEMPTS, RETRY_MIN_INTERVAL_MS } from "../../../../config";
import { createAbortController } from "../runtime/abort-controller";
import { FormSubmittedEvent, InputEventResult, isInputResponseBody } from "./input-contract";

/** Upper bound on one network attempt; past it the request is aborted so the attempt fails and the caller can retry. */
export const ATTEMPT_TIMEOUT_MS = 3000;

type InputAttemptResult =
  | { kind: "response"; response: Response; payload: unknown }
  | { kind: "failure"; error: Error; retryable: boolean };

/** Landing-host transport: fire-and-forget `_MESSAGING` batches through `start`, awaited `_FORM_SUBMITTED` through `submit`. */
export class InputEndpointExecutor implements IWebserviceExecutor {
  public constructor(
    /** Absolute endpoint, already resolved and vetted by `resolveInputEndpoint`. Every request targets it. */
    private readonly url: string,
    private readonly sessionId: string
  ) {}

  /** Posts one `_FORM_SUBMITTED` event and resolves with its server verdict, or rejects when it gets none. */
  public async submit(event: FormSubmittedEvent): Promise<InputEventResult> {
    const body = JSON.stringify({ session_id: this.sessionId, events: [event] });

    for (let attempt = 1; ; attempt += 1) {
      if (attempt > 1) {
        // oxlint-disable-next-line eslint/no-await-in-loop
        await Delay(RETRY_MIN_INTERVAL_MS);
      }
      // oxlint-disable-next-line eslint/no-await-in-loop
      const outcome = await this.post(body, true);
      const lastAttempt = attempt >= RETRY_MAX_ATTEMPTS;

      if (outcome.kind === "failure") {
        if (!outcome.retryable || lastAttempt) {
          throw outcome.error;
        }
        continue;
      }

      const { response, payload } = outcome;
      if (!response.ok) {
        if (!isRetryableStatus(response.status)) {
          Log.publicError(`[LandingPage] input events rejected: HTTP ${response.status}`);
          throw new Error(`Input batch rejected: HTTP ${response.status}`);
        }
        if (lastAttempt) {
          throw new Error(`Landing page input request failed: HTTP ${response.status}`);
        }
        continue;
      }

      // A 2xx carrying no verdict for this event is a protocol break, not a transient failure.
      if (!isInputResponseBody(payload)) {
        throw new Error("Could not parse landing page input response");
      }
      const result = payload.results.find(candidate => candidate.id === event.id);
      if (result === undefined) {
        throw new Error(`The input response carries no verdict for event ${event.id}`);
      }
      return result;
    }
  }

  /** `EventTracker` adapter for fire-and-forget `_MESSAGING`. Retry stays owned by the tracker. */
  public async start(ws: IWebservice): Promise<unknown> {
    if (!(ws instanceof EventTrackerService)) {
      throw new Error("The landing page input transport only accepts EventTrackerService batches");
    }
    // Each event's toJSON() returns its serialized shape, so the batch serializes into LandingInputRequestBody.
    const body = JSON.stringify({ session_id: this.sessionId, events: ws.getEvents() });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(this.url, new Blob([body], { type: "application/json" }));
      if (queued) {
        return {};
      }
    }

    const outcome = await this.post(body, false);
    if (outcome.kind === "failure") {
      throw outcome.error;
    }

    const { response, payload } = outcome;
    if (!response.ok) {
      if (isRetryableStatus(response.status)) {
        throw new HttpError(response, `Landing page input request failed: HTTP ${response.status}`);
      }
      // Non-retryable client error. Resolving purges the tracker buffer.
      Log.publicError(`[LandingPage] input events rejected: HTTP ${response.status}`);
      return {};
    }
    return payload;
  }

  private post(body: string, awaitingVerdict: boolean): Promise<InputAttemptResult> {
    const controller = createAbortController();
    return new Promise<InputAttemptResult>(resolve => {
      const expiry = self.setTimeout(() => {
        controller.abort();
        resolve({
          kind: "failure",
          error: new Error(`Landing page input request timed out after ${ATTEMPT_TIMEOUT_MS}ms`),
          retryable: true,
        });
      }, ATTEMPT_TIMEOUT_MS);

      const fail = (error: unknown, retryable: boolean): void => {
        clearTimeout(expiry);
        resolve({ kind: "failure", error: error instanceof Error ? error : new Error(String(error)), retryable });
      };

      fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        // CORS uses AllowCredentials=false. Do not send cookies.
        credentials: "omit",
        // keepalive survives an unload for analytics but caps the body at 64 KiB, so an awaited submit never sets it.
        redirect: "error",
        ...(awaitingVerdict ? {} : { keepalive: true }),
        signal: controller.fetchSignal,
      }).then(
        response => {
          // A failed status carries no verdict, and analytics reads none, so the body stays unread.
          if (!response.ok || !awaitingVerdict) {
            clearTimeout(expiry);
            resolve({ kind: "response", response, payload: undefined });
            return;
          }
          response.json().then(
            payload => {
              clearTimeout(expiry);
              resolve({ kind: "response", response, payload });
            },
            error => fail(error, false)
          );
        },
        error => fail(error, true)
      );
    });
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 404 || status === 429 || status >= 500;
}
