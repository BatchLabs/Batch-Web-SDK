/** Log module for action logs. Same tag as the render engine so messaging logs stay grouped. */
export const ACTION_LOG_MODULE = "Messaging";

/** Identifier of the action a form submit button carries (iOS `submitActionIdentifier`). */
export const FORM_SUBMIT_ACTION_ID = "batch.form.submit";

/** Key holding the event name inside the submit action params (iOS `eventNameKey`). */
export const FORM_SUBMIT_EVENT_NAME_KEY = "e";

/** Key holding the event attributes of the submit action params (shared with the `batch.user.event` slot). */
export const FORM_SUBMIT_ATTRIBUTES_KEY = "a";

/** Built-in action identifiers, as spelled in payloads. `DISMISS_ACTION_ALIAS` has no `batch.` prefix on purpose. */
export const DISMISS_ACTION_ID = "batch.dismiss";
export const DISMISS_ACTION_ALIAS = "dismiss";
export const DEEPLINK_ACTION_ID = "batch.deeplink";
export const CLIPBOARD_ACTION_ID = "batch.clipboard";
export const GROUP_ACTION_ID = "batch.group";
export const TRACK_EVENT_ACTION_ID = "batch.user.event";
export const USER_TAG_ACTION_ID = "batch.user.tag";
export const REQUEST_NOTIFICATIONS_ACTION_ID = "batch.request_notifications";
