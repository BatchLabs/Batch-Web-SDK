import { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";

import { RenderAnalyticsSink } from "../contracts";
import type { LandingTransport } from "./landing-transport";

/** Analytics sink for the landing-page host: filters the engine events a landing page reports, and stops on mute. */
export class LandingPageAnalyticsSink implements RenderAnalyticsSink {
  private muted = false;

  public constructor(private readonly transport?: LandingTransport) {}

  /** Stops emitting for good, when the landing gives way to a bundled outcome view. */
  public mute(): void {
    this.muted = true;
  }

  public emit(event: MessagingEventPayload): void {
    if (this.muted || !this.transport) {
      return;
    }

    if (event.type !== "displayed" && event.type !== "clicked") {
      return;
    }

    this.transport.emitEvent(event);
  }
}
