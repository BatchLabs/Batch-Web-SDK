import type { MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import type { RenderActionRegistry } from "com.batch.shared/actions/contracts";

import type { SurfaceStrategy } from "./runtime/surface/surface-strategy";

export type {
  ActionContext,
  ActionOpenWindowIntent,
  ActionOutcome,
  FormFieldValue,
  MessageActionHandler,
  RenderActionRegistry,
  RenderActionRunner,
  RenderBrowserGateway,
  RenderEventAttributes,
} from "com.batch.shared/actions/contracts";

/** A resolved component action: its identifier plus any payload parameters. */
export interface ResolvedAction {
  action: string;
  params?: Record<string, unknown>;
}

export interface RenderAnalyticsSink {
  emit(event: MessagingEventPayload): void;
}

/** The host injected into the render stack: action registry, analytics sink and surface. */
export interface RenderHost {
  actions: RenderActionRegistry;
  analyticsSink: RenderAnalyticsSink;
  surface: SurfaceStrategy;
}
