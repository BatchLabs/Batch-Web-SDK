import { MessagingCTAType, MessagingEventPayload } from "com.batch.dom/render/analytics/messaging-events";
import { FormFieldValue } from "com.batch.dom/render/contracts";
import { landingDefaultTexts } from "com.batch.dom/render/landing-page/landing-page-l10n";
import {
  RENDER_HONEYPOT_MAX_LENGTH,
  RENDER_LOG_MODULE,
  RENDER_MAPS_TO_EMAIL_ADDRESS,
  RENDER_MAPS_TO_HONEYPOT,
  RENDER_MAPS_TO_PHONE_NUMBER,
  RENDER_MAPS_TO_TOPIC_PREFERENCES,
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
  RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
} from "com.batch.dom/render/render-constants";
import { Consts } from "com.batch.shared/constants/user";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import { isSet, isString, isUnknownObject } from "com.batch.shared/helpers/primitive";
import { isSafeURL, isSecureURL } from "com.batch.shared/helpers/url";
import { Log } from "com.batch.shared/logger";
import {
  convertValueProfileAttribute,
  isProfileEmailValueValid,
  isValidAttributeKey,
  validateAndNormalizeTopicPreferences,
} from "com.batch.shared/profile/profile-data-helper";
import { PartialUpdateObject, ProfileAttributeType, ProfileNativeAttributeType } from "com.batch.shared/profile/profile-data-types";
import type { CustomAttributeType } from "com.batch.shared/profile/profile-events";

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

/** `_FORM_SUBMITTED` params: the profile slots a landing page can fill, plus its own envelope. */
export interface FormSubmittedEventParams {
  /** Serving metadata from `payload.eventData`, copied as-is. */
  ed: Record<string, string>;
  /** Anti-bot decoy value. Present only when the hidden decoy field came back filled. */
  honeypot?: string;
  email?: string;
  phone_number?: string;
  topic_preferences?: PartialUpdateObject;
  custom_attributes?: CustomAttributeType;
}

const RESERVED_PARAM_KEYS: Readonly<Partial<Record<string, true>>> = { ed: true, custom_attributes: true };

type NativeSlot = ProfileNativeAttributeType.EMAIL | ProfileNativeAttributeType.PHONE_NUMBER | ProfileNativeAttributeType.TOPIC_PREFERENCES;

/** Each `$`-prefixed `mapsTo` a landing page may target, and the param it fills. */
const NATIVE_SLOTS: Readonly<Partial<Record<string, NativeSlot>>> = {
  [RENDER_MAPS_TO_EMAIL_ADDRESS]: ProfileNativeAttributeType.EMAIL,
  [RENDER_MAPS_TO_PHONE_NUMBER]: ProfileNativeAttributeType.PHONE_NUMBER,
  [RENDER_MAPS_TO_TOPIC_PREFERENCES]: ProfileNativeAttributeType.TOPIC_PREFERENCES,
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

/** A partial update is reported as the values it checks: the CTA report describes what the user picked, not the profile operation. */
function serializeCTAFields(fields: Record<string, FormFieldValue>): string | undefined {
  const named: Record<string, string | number | boolean | Date | URL | string[]> = {};
  for (const [mapsTo, value] of Object.entries(fields)) {
    const reported = value.type === ProfileAttributeType.ARRAY ? (value.value.$add ?? []) : value.value;
    if (mapsTo.charAt(0) !== "$") {
      named[mapsTo] = reported;
      continue;
    }
    const slot = NATIVE_SLOTS[mapsTo];
    if (slot !== undefined) {
      named[`$${slot}`] = reported;
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
      if (value.type === ProfileAttributeType.STRING) {
        params.honeypot = value.value.slice(0, RENDER_HONEYPOT_MAX_LENGTH);
      }
      continue;
    }

    if (mapsTo.charAt(0) === "$") {
      const slot = NATIVE_SLOTS[mapsTo];
      if (slot === undefined) {
        Log.warn(RENDER_LOG_MODULE, `[landing] dropping form field with mapsTo "${mapsTo}": unknown native attribute`);
        continue;
      }
      if (!fillNativeSlot(params, slot, value)) {
        Log.warn(
          RENDER_LOG_MODULE,
          `[landing] dropping form field with mapsTo "${mapsTo}": the value violates profile attribute constraints`
        );
      }
      continue;
    }

    // The API rejects the whole event on a bad key, so drop the field instead of the lead; the helper names the key.
    if (!isValidAttributeKey(mapsTo)) {
      continue;
    }

    // Same for the value: drop the field rather than let the API reject the whole event.
    const converted =
      value.type === ProfileAttributeType.ARRAY
        ? convertPartialUpdate(value.value, members => {
            const set = convertValueProfileAttribute(mapsTo, ProfileAttributeType.ARRAY, members);
            return isSet(set) ? Array.from(set) : undefined;
          })
        : convertValueProfileAttribute(mapsTo, value.type, value.value);
    // A scalar type never yields a Set at runtime: the guard only narrows the declared return type.
    if (converted === undefined || isSet(converted)) {
      Log.warn(
        RENDER_LOG_MODULE,
        `[landing] dropping form field with mapsTo "${mapsTo}": the value violates profile attribute constraints`
      );
      continue;
    }
    (params.custom_attributes ??= {})[`${mapsTo}.${value.type}`] = converted;
  }
  return { id, name: InternalSDKEvent.FormSubmitted, date: date.toISOString(), params };
}

/** A native slot holds what its `_PROFILE_DATA_CHANGED` counterpart holds; `false` when the value does not fit it. */
function fillNativeSlot(params: FormSubmittedEventParams, slot: NativeSlot, value: FormFieldValue): boolean {
  switch (slot) {
    case ProfileNativeAttributeType.EMAIL:
      if (value.type !== ProfileAttributeType.STRING) {
        return false;
      }
      if (!isProfileEmailValueValid(value.value)) {
        return false;
      }
      params.email = value.value;
      return true;
    case ProfileNativeAttributeType.PHONE_NUMBER:
      // E.164, the rule the field already applies to a `$phone_number` slot whatever its `fieldType`.
      if (value.type !== ProfileAttributeType.STRING || !Consts.PhoneNumberRegexp.test(value.value)) {
        return false;
      }
      params.phone_number = value.value;
      return true;
    case ProfileNativeAttributeType.TOPIC_PREFERENCES: {
      const update =
        value.type === ProfileAttributeType.ARRAY
          ? convertPartialUpdate(value.value, members => {
              try {
                return validateAndNormalizeTopicPreferences(members);
              } catch (e) {
                Log.warn(RENDER_LOG_MODULE, `[landing] $topic_preferences: ${(e as Error).message}`);
                return undefined;
              }
            })
          : undefined;
      if (update === undefined) {
        return false;
      }
      params.topic_preferences = update;
      return true;
    }
  }
}

/** Converts each branch of a partial array update with `convert`, or `undefined` when a present branch is rejected. */
function convertPartialUpdate(
  update: PartialUpdateObject,
  convert: (members: string[]) => string[] | undefined
): PartialUpdateObject | undefined {
  const converted: PartialUpdateObject = {};
  for (const branch of ["$add", "$remove"] as const) {
    const members = update[branch];
    if (!Array.isArray(members) || members.length === 0) {
      continue; // an empty branch is omitted, not rejected
    }
    const result = convert(members);
    if (result === undefined) {
      return undefined;
    }
    converted[branch] = result;
  }
  return converted.$add === undefined && converted.$remove === undefined ? undefined : converted;
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
