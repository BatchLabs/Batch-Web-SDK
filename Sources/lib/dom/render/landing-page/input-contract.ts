import { MessagingCTAType, MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import { FormFieldValue } from "com.batch.dom/render/contracts";
import { landingDefaultTexts } from "com.batch.dom/render/landing-page/landing-page-l10n";
import {
  RENDER_HONEYPOT_MAX_LENGTH,
  RENDER_LOG_MODULE,
  RENDER_MAPS_TO_EMAIL_ADDRESS,
  RENDER_MAPS_TO_HONEYPOT,
  RENDER_MAPS_TO_PHONE_NUMBER,
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
  RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
} from "com.batch.dom/render/render-constants";
import { Consts } from "com.batch.shared/constants/user";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import { isArray, isBoolean, isDate, isFloat, isNumber, isString, isUnknownObject, isURL } from "com.batch.shared/helpers/primitive";
import { isSafeURL, isSecureURL } from "com.batch.shared/helpers/url";
import { Log } from "com.batch.shared/logger";
import {
  deduplicateKeepLast,
  isProfileStringArrayValueValid,
  isProfileStringValueValid,
  isProfileURLValueValid,
} from "com.batch.shared/profile/profile-data-helper";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { WS_URL } from "../../../../config";

/** Subset of the native `type` vocabulary a landing page can emit. */
// Envelope {id, name, date, params} matches Android TrackingQuery and iOS BAWSQueryTracking.
export type MessagingEventType = "show" | "cta_action";

export interface MessagingEventParams {
  /** Serving metadata from `payload.eventData`, copied as-is. The SDK does not create `trid` or `is_test`. */
  ed: Record<string, string>;
  type: MessagingEventType;
  ctaId?: string;
  ctaType?: MessagingCTAType;
  action?: string;
  /** What the CTA carried: the deeplink URL, the copied text, or the submitted fields as JSON. */
  value?: string;
}

export interface FormSubmittedEventParams {
  /** Serving metadata from `payload.eventData`, copied as-is. */
  ed: Record<string, string>;
  /** Anti-bot decoy value. Present only when the hidden decoy field came back filled. */
  honeypot?: string;
  /** Keyed by `{mapsTo}.{ProfileAttributeType}`, as the Profile API expects. */
  custom_attributes?: Record<string, FormFieldValue>;
  /** Native slots. Each key is a `$`-prefixed `mapsTo` without its marker. */
  [nativeSlot: string]: FormFieldValue | Record<string, string> | Record<string, FormFieldValue> | undefined;
}

const RESERVED_PARAM_KEYS: Readonly<Partial<Record<string, true>>> = { ed: true, custom_attributes: true };

const NATIVE_PARAM_KEYS: Readonly<Record<string, string>> = {
  [RENDER_MAPS_TO_EMAIL_ADDRESS]: "email",
  [RENDER_MAPS_TO_PHONE_NUMBER]: "phone_number",
};

export interface MessagingEvent {
  /** UUID, server-side dedup key. */
  id: string;
  name: InternalSDKEvent.Messaging;
  /** ISO 8601 with milliseconds, UTC. The SDK captures it at emission, not at send. */
  date: string;
  params: MessagingEventParams;
}

export interface FormSubmittedEvent {
  /** UUID, server-side dedup key. */
  id: string;
  name: InternalSDKEvent.FormSubmitted;
  /** ISO 8601 with milliseconds, UTC. The SDK captures it at emission, not at send. */
  date: string;
  params: FormSubmittedEventParams;
}

/** The two event families a landing page posts to `/lp/input`. */
export type LandingPageEvent = MessagingEvent | FormSubmittedEvent;

export interface LandingInputRequestBody {
  /** Landing session id. The module creates it at start and stores it in `sessionStorage`. */
  session_id: string;
  events: LandingPageEvent[];
}

const SERVING_ORIGIN: string | null = isSafeURL(WS_URL) ? new URL(WS_URL).origin : null;

/** Resolves the served endpoint to an absolute URL, or null unless it is https on the page's own origin or the Batch backend's. */
export function resolveInputEndpoint(endpoint: string): string | null {
  const base = typeof location !== "undefined" ? location.href : undefined;
  let resolved: URL;
  try {
    resolved = new URL(endpoint, base);
  } catch {
    return null;
  }

  const href = resolved.toString();
  if (!isSecureURL(href)) {
    return null;
  }
  if (typeof location !== "undefined" && resolved.origin === location.origin) {
    return href;
  }
  return resolved.origin === SERVING_ORIGIN ? href : null;
}

/** Maps an engine analytics payload to the flat native `_MESSAGING` params, or null for engine-only types. */
export function buildMessagingEventParams(event: MessagingEventPayload, eventData: Record<string, string>): MessagingEventParams | null {
  let type: MessagingEventType;
  if (event.type === "displayed") {
    type = "show";
  } else if (event.type === "clicked") {
    type = "cta_action";
  } else {
    return null;
  }

  const params: MessagingEventParams = { ed: eventData, type };
  if (event.ctaId !== undefined) {
    params.ctaId = event.ctaId;
  }
  if (event.ctaType !== undefined) {
    params.ctaType = event.ctaType;
  }
  if (event.action !== undefined) {
    params.action = event.action;
  }
  if (event.value !== undefined) {
    // An action that declared no payload gets no slot; whitespace is a payload and travels as declared.
    const value = typeof event.value === "string" ? (event.value.length > 0 ? event.value : undefined) : serializeCTAFields(event.value);
    if (value !== undefined) {
      params.value = value;
    }
  }
  return params;
}

function serializeCTAFields(fields: Record<string, FormFieldValue>): string | undefined {
  const named: Record<string, FormFieldValue> = {};
  for (const [mapsTo, value] of Object.entries(fields)) {
    if (mapsTo.charAt(0) !== "$") {
      named[mapsTo] = value;
      continue;
    }
    const slot = NATIVE_PARAM_KEYS[mapsTo];
    if (slot !== undefined) {
      named[`$${slot}`] = value;
    }
  }
  return Object.keys(named).length > 0 ? JSON.stringify(named) : undefined;
}

/** Builds the `_FORM_SUBMITTED` event from the collected fields, keyed by each field's `mapsTo`. */
export function buildFormSubmittedEvent(
  id: string,
  date: Date,
  fields: Record<string, FormFieldValue>,
  eventData: Record<string, string>
): FormSubmittedEvent {
  const params: FormSubmittedEventParams = { ed: eventData };
  for (const [mapsTo, value] of Object.entries(fields)) {
    if (RESERVED_PARAM_KEYS[mapsTo] === true) {
      Log.warn(RENDER_LOG_MODULE, `[landing] dropping form field with mapsTo "${mapsTo}": the key is reserved by the event envelope`);
      continue;
    }

    // The decoy is not a profile attribute: no type suffix and no value contract, only a length cap.
    if (mapsTo === RENDER_MAPS_TO_HONEYPOT) {
      params.honeypot = (isString(value) ? value : String(value)).slice(0, RENDER_HONEYPOT_MAX_LENGTH);
      continue;
    }

    if (mapsTo.charAt(0) === "$") {
      const slot = NATIVE_PARAM_KEYS[mapsTo];
      if (slot === undefined) {
        Log.warn(RENDER_LOG_MODULE, `[landing] dropping form field with mapsTo "${mapsTo}": unknown native attribute`);
        continue;
      }
      // A native slot takes the same converted value as a custom attribute, minus the type suffix.
      const attribute = isNativeSlotValueValid(mapsTo, value) ? profileAttributeOf(value) : null;
      if (attribute === null) {
        Log.warn(
          RENDER_LOG_MODULE,
          `[landing] dropping form field with mapsTo "${mapsTo}": the value violates profile attribute constraints`
        );
        continue;
      }
      params[slot] = attribute.value;
      continue;
    }

    // The API rejects the whole event on a bad key, so drop the field instead of the lead.
    if (!Consts.AttributeKeyRegexp.test(mapsTo)) {
      Log.warn(RENDER_LOG_MODULE, `[landing] dropping form field with mapsTo "${mapsTo}": the key is not a valid custom attribute key`);
      continue;
    }

    // Same for the value: drop the field rather than let the API reject the whole event.
    const attribute = profileAttributeOf(value);
    if (attribute === null) {
      Log.warn(
        RENDER_LOG_MODULE,
        `[landing] dropping form field with mapsTo "${mapsTo}": the value violates profile attribute constraints`
      );
      continue;
    }
    (params.custom_attributes ??= {})[`${mapsTo}.${attribute.type}`] = attribute.value;
  }
  return { id, name: InternalSDKEvent.FormSubmitted, date: date.toISOString(), params };
}

function profileAttributeOf(value: FormFieldValue): { type: ProfileAttributeType; value: string | number | boolean | string[] } | null {
  if (isURL(value)) {
    return isProfileURLValueValid(value) ? { type: ProfileAttributeType.URL, value: URL.prototype.toString.call(value) } : null;
  }
  if (isDate(value)) {
    return { type: ProfileAttributeType.DATE, value: value.getTime() };
  }
  if (isBoolean(value)) {
    return { type: ProfileAttributeType.BOOLEAN, value };
  }
  if (isArray(value)) {
    // Mirror of the profile array path, in its order: lowercase, deduplicate last-wins, then validate.
    const normalized = deduplicateKeepLast(value.map(it => (isString(it) ? it.toLocaleLowerCase() : it)));
    return isProfileStringArrayValueValid(normalized) ? { type: ProfileAttributeType.ARRAY, value: normalized } : null;
  }
  if (isFloat(value)) {
    return { type: ProfileAttributeType.FLOAT, value };
  }
  if (isNumber(value)) {
    return { type: ProfileAttributeType.INTEGER, value };
  }
  return isProfileStringValueValid(value) ? { type: ProfileAttributeType.STRING, value } : null;
}

function isNativeSlotValueValid(mapsTo: string, value: FormFieldValue): boolean {
  if (mapsTo === RENDER_MAPS_TO_EMAIL_ADDRESS) {
    if (!Consts.EmailAddressRegexp.test(isString(value) ? value : String(value))) {
      return false;
    }
    return !isString(value) || value.length <= Consts.EmailAddressMaxLength;
  }
  if (mapsTo === RENDER_MAPS_TO_PHONE_NUMBER) {
    return !isString(value) || isProfileStringValueValid(value);
  }
  return true;
}

export type FieldErrorCode = "required" | "too_short" | "too_long" | "invalid_email" | "invalid_phone" | "invalid_format" | "unknown_field";

export interface InputEventResult {
  id: string;
  status: "accepted" | "rejected";
  /** Keyed by field id. Values are FieldErrorCode today. The type stays open for forward compatibility. */
  errors?: Record<string, string>;
}

export interface InputResponseBody {
  results: InputEventResult[];
}

export function isInputResponseBody(value: unknown): value is InputResponseBody {
  return isUnknownObject(value) && Array.isArray(value.results) && value.results.every(isInputEventResult);
}

function isInputEventResult(value: unknown): value is InputEventResult {
  if (!isUnknownObject(value) || !isString(value.id)) {
    return false;
  }
  if (value.status !== "accepted" && value.status !== "rejected") {
    return false;
  }
  return value.errors === undefined || isStringRecord(value.errors);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isUnknownObject(value) && Object.values(value).every(isString);
}

const FIELD_ERROR_TEXT_KEYS: Readonly<Record<string, string>> = {
  required: RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
  invalid_email: RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  invalid_phone: RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
};

/** Maps server FieldErrorCodes to localized messages, degrading an unknown code to the generic invalid message. */
export function localizeFieldErrors(errors: Record<string, string>, texts: Readonly<Record<string, string>>): Record<string, string> {
  const localized: Record<string, string> = {};
  for (const [fieldId, code] of Object.entries(errors)) {
    if (code === "unknown_field") {
      Log.publicError(
        `[LandingPage] the webservice rejected field "${fieldId}" as unknown: the served payload declares a field the page definition does not allow`
      );
    }
    const textKey = FIELD_ERROR_TEXT_KEYS[code] ?? RENDER_TEXT_KEY_FORM_INVALID_ERROR;
    localized[fieldId] = resolveText(texts, textKey);
  }
  return localized;
}

function resolveText(texts: Readonly<Record<string, string>>, key: string): string {
  const text = texts[key];
  if (typeof text === "string" && text.length > 0) {
    return text;
  }
  return landingDefaultTexts("en")[key] ?? "";
}
