import type { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import UUID from "com.batch.shared/helpers/uuid";
import { Log } from "com.batch.shared/logger";

import { buildFormSubmittedEvent, buildMessagingEventParams, resolveInputEndpoint } from "./input-contract";
import type { LandingInputRequestBody, MessagingEvent } from "./input-contract";
import { resolveLandingSessionId } from "./landing-session";
import type { LandingSubmitVerdict, LandingTransport } from "./landing-transport";

export interface LandingPreviewTransportConfig {
  /** Endpoint authored in `data-input-endpoint`. Logged, never posted to. */
  inputEndpoint: string;
  /** `payload.eventData`, copied into every `params.ed` like the real transport does. */
  eventData: Record<string, string>;
}

/** {@link LandingTransport} for a preview render: every submit succeeds locally and each skipped request is logged. */
export function createLandingPreviewTransport(config: LandingPreviewTransportConfig): LandingTransport {
  const url = resolveInputEndpoint(config.inputEndpoint) ?? config.inputEndpoint;
  const sessionId = resolveLandingSessionId();

  Log.public(
    "[LandingPage] preview mode: nothing is sent to Batch. Every submit succeeds locally; each request the page would have posted is logged here instead."
  );

  return {
    submitFields(fields: Record<string, FormFieldValue>): Promise<LandingSubmitVerdict> {
      const event = buildFormSubmittedEvent(UUID(), new Date(), fields, config.eventData);
      logSkippedRequest(url, { session_id: sessionId, events: [event] });
      return Promise.resolve({ status: "accepted" });
    },
    emitEvent(event: MessagingEventPayload): void {
      const params = buildMessagingEventParams(event, config.eventData);
      if (params === null) {
        return;
      }
      const serialized: MessagingEvent = { id: UUID(), name: InternalSDKEvent.Messaging, date: new Date().toISOString(), params };
      logSkippedRequest(url, { session_id: sessionId, events: [serialized] });
    },
  };
}

const SKIPPED_REQUEST_PREFIX = "[LandingPage] preview mode: skipped POST ";

function logSkippedRequest(url: string, body: LandingInputRequestBody): void {
  Log.public(`${SKIPPED_REQUEST_PREFIX}${url}`, body);
}
