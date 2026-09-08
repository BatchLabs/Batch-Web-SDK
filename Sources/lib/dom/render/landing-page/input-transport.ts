import type { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import EventTracker from "com.batch.shared/event/event-tracker";
import { ISerializableEvent } from "com.batch.shared/event/serializable-event";
import UUID from "com.batch.shared/helpers/uuid";
import safeGetWindow from "com.batch.shared/helpers/window";
import { Log } from "com.batch.shared/logger";

import {
  buildFormSubmittedEvent,
  buildMessagingEventParams,
  localizeFieldErrors,
  MessagingEvent,
  MessagingEventParams,
  resolveInputEndpoint,
} from "./input-contract";
import { InputEndpointExecutor } from "./input-endpoint-executor";
import { resolveLandingSessionId } from "./landing-session";
import type { LandingSubmitVerdict, LandingTransport } from "./landing-transport";

export interface LandingInputTransportConfig {
  /** Input endpoint that the served page advertises in `data-input-endpoint`. Vetted by `resolveInputEndpoint`, then posted to unchanged. */
  inputEndpoint: string;
  /** Serving metadata from `payload.eventData`. Every event copies it as-is into `params.ed`. */
  eventData: Record<string, string>;
  /** Merged texts, embedded l10n under serving overrides. They localize the server FieldErrorCodes. */
  texts: Readonly<Record<string, string>>;
}

class LandingMessagingEvent implements ISerializableEvent {
  public readonly id: string = UUID();
  public readonly name: InternalSDKEvent.Messaging = InternalSDKEvent.Messaging;
  private readonly date: Date = new Date();

  public constructor(private readonly params: MessagingEventParams) {}

  public toJSON(): MessagingEvent {
    return { id: this.id, name: this.name, date: this.date.toISOString(), params: this.params };
  }
}

/** Builds the {@link LandingTransport} over the input webservice, or undefined when the served endpoint is not a legitimate target. */
export function createLandingInputTransport(config: LandingInputTransportConfig): LandingTransport | undefined {
  const url = resolveInputEndpoint(config.inputEndpoint);
  if (url === null) {
    Log.publicError(
      `[LandingPage] refusing to post form data to "${config.inputEndpoint}": an input endpoint must be an http(s) URL on this page's origin or on the Batch backend`
    );
    return undefined;
  }

  const executor = new InputEndpointExecutor(url, resolveLandingSessionId());
  const analyticsTracker = new EventTracker(executor);
  flushAnalyticsWhenLeaving(analyticsTracker);

  let submission: { id: string; date: string; fingerprint: string } | null = null;

  return {
    async submitFields(fields: Record<string, FormFieldValue>): Promise<LandingSubmitVerdict> {
      // Two submits of the same serialized params are the same logical submission.
      const candidate = buildFormSubmittedEvent(UUID(), new Date(), fields, config.eventData);
      const fingerprint = JSON.stringify(candidate.params);
      const event =
        submission !== null && submission.fingerprint === fingerprint
          ? { ...candidate, id: submission.id, date: submission.date }
          : candidate;
      submission = { id: event.id, date: event.date, fingerprint };

      const result = await executor.submit(event);
      // A verdict closes this submission; the next one mints its own id and date.
      submission = null;

      if (result.status === "accepted") {
        return { status: "accepted" };
      }
      // The server sends FieldErrorCodes; the host only handles displayable messages.
      return { status: "rejected", fieldErrors: localizeFieldErrors(result.errors ?? {}, config.texts) };
    },

    emitEvent(event: MessagingEventPayload): void {
      const params = buildMessagingEventParams(event, config.eventData);
      if (params === null) {
        return;
      }
      analyticsTracker.track(new LandingMessagingEvent(params));

      // A clicked CTA can navigate away immediately, so flush past the debounce.
      if (event.type === "clicked") {
        analyticsTracker.flush();
      }
    },
  };
}

// pagehide, not beforeunload: mobile browsers skip it and registering it disqualifies the page from the bfcache.
function flushAnalyticsWhenLeaving(analyticsTracker: EventTracker): void {
  const safeWindow = safeGetWindow();
  if (safeWindow === null) {
    return;
  }
  safeWindow.addEventListener("pagehide", () => analyticsTracker.flush());
  safeWindow.document.addEventListener("visibilitychange", () => {
    if (safeWindow.document.visibilityState === "hidden") {
      analyticsTracker.flush();
    }
  });
}
