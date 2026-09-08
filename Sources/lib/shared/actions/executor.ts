import { Log } from "com.batch.shared/logger";

import { ActionContext, ActionOutcome, MessageActionHandler } from "./contracts";

export interface MessageActionRequest {
  action: string;
  args?: Record<string, unknown>;
}

const RESERVED_ACTION_IDENTIFIER_PREFIX = "batch.";

/** Registry-based action dispatcher: it maps lowercased `name + args` identifiers to handlers. */
export class MessageActionExecutor {
  private readonly hostHandlers = new Map<string, MessageActionHandler>();
  private readonly customHandlers = new Map<string, MessageActionHandler>();

  /** Host-side registration. It accepts reserved identifiers. */
  public register(name: string, handler: MessageActionHandler): void {
    this.hostHandlers.set(normalizeActionIdentifier(name), handler);
  }

  public async execute(request: MessageActionRequest, context: ActionContext = {}): Promise<ActionOutcome> {
    if (typeof request.action !== "string" || !request.action.trim()) {
      Log.publicError("[Message] Cannot perform a message action without an identifier");
      return { kind: "none" };
    }
    const handler = this._resolveHandler(request.action);
    if (!handler) {
      Log.publicError(`[Message] No handler registered for message action "${request.action}". Did you forget to register it?`);
      return { kind: "none" };
    }
    return handler(request.args ?? {}, context);
  }

  public hasAction(name: string): boolean {
    return this._resolveHandler(name) != null;
  }

  /** Public registration for custom actions. The `batch.` namespace and the host actions stay locked. */
  public registerAction(name: string, handler: MessageActionHandler): void {
    if (typeof handler !== "function") {
      throw new Error("Cannot register custom message action: handler must be a function");
    }

    const normalizedName = normalizeActionIdentifier(name);
    if (normalizedName.startsWith(RESERVED_ACTION_IDENTIFIER_PREFIX) || this.hostHandlers.has(normalizedName)) {
      throw new Error(`Cannot register custom message action '${name}': identifier is reserved`);
    }

    this.customHandlers.set(normalizedName, handler);
  }

  public unregisterAction(name: string): void {
    const normalizedName = normalizeActionIdentifier(name);
    this.customHandlers.delete(normalizedName);
  }

  private _resolveHandler(name: string): MessageActionHandler | undefined {
    const normalizedAction = normalizeActionIdentifier(name);
    // A Map lookup cannot resolve prototype members, so "constructor" never maps to a handler.
    return this.hostHandlers.get(normalizedAction) ?? this.customHandlers.get(normalizedAction);
  }
}

function normalizeActionIdentifier(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Cannot use an empty message action identifier");
  }

  return normalized;
}
