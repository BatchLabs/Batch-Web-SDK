import type { EventAttributeType, TypedEventAttributeValue } from "com.batch.shared/event/event-types";
import { type PartialUpdateObject, ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

/**
 * What a form field hands to the submit, labelled with the profile type its component declared.
 * Not `BatchSDK.ProfileTypedAttributeValue`: a public array replaces the attribute, a form array is a partial update
 * bounded to the options it shows, so replacing would erase the members the app or another page set.
 */
export type FormFieldValue =
  | { type: ProfileAttributeType.STRING; value: string }
  | { type: ProfileAttributeType.BOOLEAN; value: boolean }
  | { type: ProfileAttributeType.INTEGER; value: number }
  | { type: ProfileAttributeType.FLOAT; value: number }
  | { type: ProfileAttributeType.DATE; value: Date }
  | { type: ProfileAttributeType.URL; value: URL }
  | { type: ProfileAttributeType.ARRAY; value: PartialUpdateObject };

/** An event attribute value: an autodetected value, or the typed `{ type, value }` form. */
export type RenderEventAttributeValue = EventAttributeType | TypedEventAttributeValue;

/** Event attributes the event-tracking action ports accept, keyed by attribute name. */
export type RenderEventAttributes = { [key: string]: RenderEventAttributeValue | undefined };

/** Where and how a resolved action asks its host to open a URL. */
export interface ActionOpenWindowIntent {
  url: string;
  target: "_self" | "_blank";
  features: string;
}

/** Ambient context handed to action handlers: the submit form fields, or a submit-CTA tap report. */
export interface ActionContext {
  formFields?: Record<string, FormFieldValue>;
  formClick?: { values: Record<string, FormFieldValue> };
}

/** Result of resolving or executing an action. */
export type ActionOutcome =
  | { kind: "none" }
  | { kind: "dismiss" }
  | { kind: "open_window"; openWindow: ActionOpenWindowIntent }
  | {
      kind: "form-feedback";
      status: "success" | "error";
      message?: string;
      fieldErrors?: Record<string, string>;
      openWindow?: ActionOpenWindowIntent;
    };

/** A registered action implementation: the `name + args` contract shared with the native SDKs. */
export type MessageActionHandler = (args: Record<string, unknown>, context: ActionContext) => ActionOutcome | Promise<ActionOutcome>;

/** Narrow view of the action executor for collaborators that only run actions. */
export interface RenderActionRunner {
  execute(request: { action: string; args?: Record<string, unknown> }, context?: ActionContext): Promise<ActionOutcome>;
  hasAction(name: string): boolean;
}

/** The action registry of a host. An unregistered action degrades and never throws. */
export interface RenderActionRegistry extends RenderActionRunner {
  register(name: string, handler: MessageActionHandler): void;
  registerAction(name: string, handler: MessageActionHandler): void;
  unregisterAction(name: string): void;
}

/** Navigation surface a host binds the built-ins to. It opens URLs. */
export interface RenderBrowserGateway {
  openExternalURL(url: string, target: "_self" | "_blank", features: string): void;
}
