import type { FormFieldValue } from "com.batch.shared/actions/contracts";

/** `displayed` and `clicked` match the backend vocabulary; the others are engine lifecycle events. */
export type MessagingEventType = "displayed" | "dismiss" | "close" | "auto_close" | "clicked" | "close_error";

export type MessagingCTAType = "button" | "image";

export interface MessagingEventPayload {
  type: MessagingEventType;
  id?: string;
  ed?: Record<string, string>;
  ctaId?: string;
  ctaType?: MessagingCTAType;
  action?: string;
  /** What the CTA carried: a string, or the collected fields keyed by `mapsTo` on a form submit. */
  value?: string | Record<string, FormFieldValue>;
  cause?: number;
}
