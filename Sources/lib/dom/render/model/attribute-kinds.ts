import type { FormFieldValue } from "com.batch.shared/actions/contracts";
import { Consts } from "com.batch.shared/constants/user";
import { isProfileURLValueValid } from "com.batch.shared/profile/profile-data-helper";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { type MessageAttributeType, MessageAttributeTypeValue } from "./types";

export interface AttributeKind {
  /** `null` when the text is not a value of this kind. */
  parse(text: string): FormFieldValue | null;
}

/** 15 digits keep every accepted entry a safe integer, sign excluded. */
export const INTEGER_PATTERN = "^-?\\d{1,15}$";
/** The decimal comma is a locale matter and stays out. */
export const FLOAT_PATTERN = "^-?\\d{1,15}(\\.\\d+)?$";
const INTEGER_REGEX = new RegExp(INTEGER_PATTERN);
const FLOAT_REGEX = new RegExp(FLOAT_PATTERN);
/** An instant written as epoch milliseconds, as the profile API reads a date. */
const EPOCH_MILLIS_REGEX = /^[-+]?\d+$/;
/** `YYYY-MM-DD`, or an offset datetime (seconds and fraction optional): a datetime without zone names no instant. */
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:[0-5]\d))?$/i;

/**
 * The UTF-8 length of a text, the unit the landing page webservice and the profile store bound a string in: an accented
 * letter is 1 JavaScript character but 2 bytes. A lone surrogate counts the 3 bytes of the U+FFFD it is encoded as.
 */
function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** The instant a date text names, or null. The day is checked because `Date.parse` in V8 rolls an impossible one over. */
function parseDateTime(text: string): number | null {
  if (EPOCH_MILLIS_REGEX.test(text)) {
    const time = new Date(Number(text)).getTime();
    return Number.isNaN(time) ? null : time;
  }
  const match = ISO_DATE_REGEX.exec(text);
  if (match === null) {
    return null;
  }
  const [year, month, day] = match.slice(1, 4).map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) {
    return null;
  }
  // The ECMAScript date format guarantees only uppercase and a 3-digit fraction; the content API also allows lowercase and up to 9 digits.
  const time = Date.parse(text.toUpperCase().replace(/\.(\d+)/, (_, fraction: string) => `.${fraction.padEnd(3, "0").slice(0, 3)}`));
  return Number.isNaN(time) ? null : time;
}

/** A profile type a landing component can write. */
export type MessageProfileAttributeType = Exclude<ProfileAttributeType, ProfileAttributeType.UNKNOWN>;
/** A type with a text form: an array's members are strings, an array itself has none. */
export type MessageScalarAttributeType = Exclude<MessageProfileAttributeType, ProfileAttributeType.ARRAY>;

/** Payload word → profile type. The normalizer converts once; nothing downstream reads the word. */
export const PROFILE_ATTRIBUTE_TYPES: Readonly<Record<MessageAttributeType, MessageProfileAttributeType>> = {
  [MessageAttributeTypeValue.String]: ProfileAttributeType.STRING,
  [MessageAttributeTypeValue.Boolean]: ProfileAttributeType.BOOLEAN,
  [MessageAttributeTypeValue.Integer]: ProfileAttributeType.INTEGER,
  [MessageAttributeTypeValue.Float]: ProfileAttributeType.FLOAT,
  [MessageAttributeTypeValue.Date]: ProfileAttributeType.DATE,
  [MessageAttributeTypeValue.Url]: ProfileAttributeType.URL,
  [MessageAttributeTypeValue.Array]: ProfileAttributeType.ARRAY,
};

export const ATTRIBUTE_KINDS = {
  [ProfileAttributeType.STRING]: {
    // Bounded in bytes, not in characters: the server refuses a value past the bound, so a longer one could never be submitted.
    parse: text =>
      text.length > 0 && utf8Length(text) <= Consts.AttributeStringMaxLengthCEP ? { type: ProfileAttributeType.STRING, value: text } : null,
  },
  [ProfileAttributeType.BOOLEAN]: {
    parse: text => (text === "true" || text === "false" ? { type: ProfileAttributeType.BOOLEAN, value: text === "true" } : null),
  },
  [ProfileAttributeType.INTEGER]: {
    parse: text => (INTEGER_REGEX.test(text) ? { type: ProfileAttributeType.INTEGER, value: Number(text) } : null),
  },
  [ProfileAttributeType.FLOAT]: {
    parse: text => (FLOAT_REGEX.test(text) ? { type: ProfileAttributeType.FLOAT, value: Number(text) } : null),
  },
  [ProfileAttributeType.DATE]: {
    parse: text => {
      const time = parseDateTime(text);
      return time === null ? null : { type: ProfileAttributeType.DATE, value: new Date(time) };
    },
  },
  // An absolute URL with a host, as Java's `uri.isAbsolute() && host != null`: `mailto:` and `javascript:` have none.
  [ProfileAttributeType.URL]: {
    parse: text => {
      try {
        const url = new URL(text);
        return url.host !== "" && isProfileURLValueValid(url) ? { type: ProfileAttributeType.URL, value: url } : null;
      } catch {
        return null;
      }
    },
  },
} satisfies Record<MessageScalarAttributeType, AttributeKind>;

/** `boolean` and `array` have no text form. */
export const INPUT_ATTRIBUTE_TYPES = [
  ProfileAttributeType.STRING,
  ProfileAttributeType.INTEGER,
  ProfileAttributeType.FLOAT,
  ProfileAttributeType.DATE,
  ProfileAttributeType.URL,
] as const;

export type MessageInputAttributeType = (typeof INPUT_ATTRIBUTE_TYPES)[number];

export function isInputAttributeType(type: MessageProfileAttributeType): type is MessageInputAttributeType {
  return (INPUT_ATTRIBUTE_TYPES as readonly MessageProfileAttributeType[]).includes(type);
}
