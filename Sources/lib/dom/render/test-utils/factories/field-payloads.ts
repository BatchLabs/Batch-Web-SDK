import type { MessagePayload } from "com.batch.dom/render/model/types";

import { buildFormFieldMessage } from "./renderer-payloads";

export const FIELD_ID = "email";
const FIELD_MAP_TO = "email_map";

export const FIELD_TEXTS = { email_label: "Email", email_ph: "you@example.com" };

export function buildFieldMessage(patch: Record<string, unknown>, message?: Partial<MessagePayload>): MessagePayload {
  return buildFormFieldMessage(
    { type: "field", id: FIELD_ID, mapsTo: FIELD_MAP_TO, placeholderId: "email_ph", labelTextId: "email_label", ...patch },
    message,
    FIELD_TEXTS
  );
}
