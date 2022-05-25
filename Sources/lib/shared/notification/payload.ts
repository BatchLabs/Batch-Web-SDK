import type { IBatchPushPayload, IPushPayload } from "./payload-types";

export class Action {
  public action: string;
  public args: Record<string, unknown>;
  public label: string;
  public iconURL?: string;

  // These two methods will need to be rewritten if this class gets more complex
  public static fromJSON(json: string): unknown {
    return Object.assign(new Action(), JSON.parse(json));
  }

  public toJSONString(): string {
    return JSON.stringify(Object.assign({}, this));
  }
}

export class Payload {
  public rawPayload: IPushPayload;
  public batchPayload: IBatchPushPayload;

  public constructor(rawPayload: { [key: string]: unknown } | undefined | null) {
    if (rawPayload == null) {
      throw new Error("Push payload cannot be null");
    }

    if (!Payload.hasEssentialKeys(rawPayload)) {
      throw new Error("Push payload lacks essential keys. It is probably not a Batch push payload.");
    }
    this.rawPayload = rawPayload;
    this.batchPayload = this.rawPayload["com.batch"] as IBatchPushPayload;
  }

  public static hasEssentialKeys(payload: Partial<IPushPayload> | null | undefined): payload is IPushPayload {
    return (
      typeof payload === "object" &&
      payload !== null &&
      typeof payload["com.batch"] === "object" &&
      typeof payload.title === "string" &&
      payload.title.length > 0 &&
      typeof payload.alert === "string" &&
      payload.alert.length > 0 &&
      typeof payload["com.batch"].da === "object"
    );
  }

  public enforceString(val: unknown): string | undefined {
    return typeof val === "string" ? val : undefined;
  }

  public getTitle(): string {
    return this.rawPayload.title; // This has already been enforced
  }

  public getBody(): string {
    return this.rawPayload.alert; // This has already been enforced
  }

  public getIconURL(): string | undefined {
    return this.enforceString(this.batchPayload.icu);
  }

  public getImageURL(): string | undefined {
    return this.enforceString(this.batchPayload.imu);
  }

  // AKA Small Icon, on Android
  public getBadgeImageURL(): string | undefined {
    return this.enforceString(this.batchPayload.siu);
  }

  public getTag(): string | undefined {
    return this.enforceString(this.batchPayload.ni);
  }

  public shouldRenotify(): boolean | undefined {
    const rn = this.batchPayload.rn;
    if (typeof rn !== "boolean") {
      return undefined;
    }
    return rn;
  }

  public requireInteraction(): boolean | undefined {
    const ri = this.batchPayload.ri;
    if (typeof ri !== "boolean") {
      return undefined;
    }
    return ri;
  }

  public getDefaultAction(): Action | null {
    const rawAction = this.batchPayload.da;
    if (!rawAction) {
      return null;
    }
    const actionString = rawAction.a;
    if (typeof actionString !== "string" || actionString.length === 0) {
      return null;
    }

    const action = new Action();
    action.label = "";
    action.iconURL = "";
    action.action = actionString;
    action.args = typeof rawAction.args === "object" ? rawAction.args : {};
    return action;
  }

  public getActions(): Action[] {
    const rawActions = this.batchPayload.aa;
    if (!Array.isArray(rawActions)) {
      return [];
    }
    return rawActions
      .map(a => {
        const action = new Action();
        const actionString = a.a;
        const label = a.l;

        if (typeof actionString !== "string" || actionString.length === 0 || typeof label !== "string" || label.length === 0) {
          return null;
        }

        action.label = label;
        action.action = actionString;
        action.iconURL = this.enforceString(a.i);
        action.args = typeof a.args === "object" ? a.args : {};
        return action;
      })
      .filter(a => a != null) as Action[];
  }

  public getSendID(): string | undefined | null {
    return this.batchPayload.i;
  }

  public getOpenData(): object | undefined | null {
    const od = this.batchPayload.od;
    if (typeof od !== "object") {
      return undefined;
    }
    return od;
  }

  public shouldSendReadReceipt(): boolean {
    return !!this.batchPayload.rr;
  }

  public isSilent(): boolean {
    return !!this.batchPayload.sl;
  }
}

export default Payload;
