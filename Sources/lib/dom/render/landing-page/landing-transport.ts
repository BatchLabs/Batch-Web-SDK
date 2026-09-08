import type { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import type { FormFieldValue } from "com.batch.shared/actions/contracts";

/**
 * Port between the landing host and the input webservice. Optional: with no transport a submit degrades to the
 * service-unavailable path.
 */
export interface LandingTransport {
  /** Submits the collected field values and resolves with the server verdict, or rejects when it gets none. */
  submitFields(fields: Record<string, FormFieldValue>): Promise<LandingSubmitVerdict>;

  /** Hands an engine analytics event to the transport. Fire-and-forget. */
  emitEvent(event: MessagingEventPayload): void;
}

/** Server verdict; `fieldErrors` holds already-localized messages keyed by field id. */
export type LandingSubmitVerdict = { status: "accepted" } | { status: "rejected"; fieldErrors: Record<string, string> };
