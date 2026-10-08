import { MessagingCTAType, MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import { MessageComponentModel, MessageModel } from "com.batch.dom/render/model/model";
import { MessageComponentTypeValue } from "com.batch.dom/render/model/types";

export enum MessageCloseErrorCause {
  Unknown = 0,
  ServerFailure = 1,
  InvalidResponse = 2,
  ClientNetwork = 3,
}

interface MessageAnalyticsContext {
  id?: string;
  ed?: Record<string, string>;
}

type MessageAnalyticsEmitter = (event: MessagingEventPayload) => void;

export class MessageAnalyticsWrapper {
  private calledMethods = new Set<string>();
  private context: MessageAnalyticsContext;
  private emit: MessageAnalyticsEmitter;

  public constructor(message: MessageModel, emit: MessageAnalyticsEmitter) {
    this.context = {
      id: sanitizeOptionalString(message.trackingId),
      ed: sanitizeEventData(message.eventData),
    };
    this.emit = emit;
  }

  public trackDisplayed(): void {
    if (this.ensureOnce("displayed")) {
      return;
    }
    this.emitEvent({ type: "displayed" });
  }

  public trackDismissed(): void {
    if (this.ensureOnce("dismissed")) {
      return;
    }
    this.emitEvent({ type: "dismiss" });
  }

  public trackClosed(): void {
    if (this.ensureOnce("closed")) {
      return;
    }
    this.emitEvent({ type: "close" });
  }

  public trackAutoClosed(): void {
    if (this.ensureOnce("autoclosed")) {
      return;
    }
    this.emitEvent({ type: "auto_close" });
  }

  public trackClicked(ctaId: string, ctaType: MessagingCTAType, action?: string, value?: MessagingEventPayload["value"]): void {
    // Deduplicate per CTA, not per surface: each distinct CTA emits once per page view.
    if (this.ensureOnce(`cta:${ctaId}`)) {
      return;
    }
    this.emitEvent({
      type: "clicked",
      ctaId,
      ctaType,
      action,
      // Reported as the CTA declared it: trimming would report something the visitor never got.
      value,
    });
  }

  public trackCloseError(cause: MessageCloseErrorCause): void {
    if (this.ensureOnce("closeerror")) {
      return;
    }
    this.emitEvent({
      type: "close_error",
      cause,
    });
  }

  private ensureOnce(method: string): boolean {
    if (this.calledMethods.has(method)) {
      return true;
    }
    this.calledMethods.add(method);
    return false;
  }

  private emitEvent(event: Omit<MessagingEventPayload, "id" | "ed">): void {
    this.emit({
      ...(this.context.id ? { id: this.context.id } : {}),
      ...(this.context.ed ? { ed: this.context.ed } : {}),
      ...event,
    });
  }
}

function sanitizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeEventData(value: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof k === "string" && typeof v === "string") {
      result[k] = v;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function ctaTypeForComponentId(message: MessageModel, componentId: string): MessagingCTAType {
  const component = findComponentById(message.root.children, componentId);
  switch (component?.type) {
    case MessageComponentTypeValue.Image:
      return "image";
    case MessageComponentTypeValue.Button:
    default:
      return "button";
  }
}

function findComponentById(components: MessageComponentModel[], componentId: string): MessageComponentModel | null {
  for (const component of components) {
    if ("id" in component && component.id === componentId) {
      return component;
    }
    if (component.type === MessageComponentTypeValue.Columns) {
      const children = component.configuration.children.filter((child): child is MessageComponentModel => child != null);
      const match = findComponentById(children, componentId);
      if (match != null) {
        return match;
      }
    }
  }
  return null;
}
