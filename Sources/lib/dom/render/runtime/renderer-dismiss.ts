import { MessageAnalyticsWrapper, MessageCloseErrorCause } from "com.batch.dom/render/analytics/analytics-wrapper";
import type { MessagingCTAType } from "com.batch.dom/render/analytics/messaging-events";

/** Every way a mounted message can be dismissed; `reason` discriminates the union. */
export type DismissEvent =
  | { reason: "api_hide" }
  | { reason: "cta"; ctaId: string; ctaType: MessagingCTAType; action?: string }
  | { reason: "user_close" | "auto_close" }
  | { reason: "error"; cause: MessageCloseErrorCause };

/** Maps a dismiss event to analytics calls and always ends with a terminal `dismiss` emission. */
export function trackDismiss(analytics: MessageAnalyticsWrapper | null, event: DismissEvent): void {
  if (!analytics) {
    return;
  }

  switch (event.reason) {
    case "user_close":
      analytics.trackClosed();
      break;
    case "auto_close":
      analytics.trackAutoClosed();
      break;
    case "error":
      analytics.trackCloseError(event.cause);
      break;
  }

  analytics.trackDismissed();
}
