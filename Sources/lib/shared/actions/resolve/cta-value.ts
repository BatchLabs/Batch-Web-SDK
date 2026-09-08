import { asString } from "com.batch.shared/helpers/primitive";

import { CLIPBOARD_ACTION_ID, DEEPLINK_ACTION_ID } from "../constants";

/** What a CTA carried, for the analytics `value` slot. The value is read as declared, before any safety check. */
export function resolveCTAValue(action: string | undefined, args: Record<string, unknown> | undefined): string | undefined {
  // Names match case-insensitively, like the registry resolves them.
  switch (action?.trim().toLowerCase()) {
    case DEEPLINK_ACTION_ID:
      return asString(args?.["l"]);
    case CLIPBOARD_ACTION_ID:
      return asString(args?.["t"]) ?? asString(args?.["text"]);
    default:
      return undefined;
  }
}
