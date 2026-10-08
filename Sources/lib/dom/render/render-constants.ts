export const RENDER_LOG_MODULE = "Messaging";

/** The form submit action id and its arg keys belong to the action contract. */
export { FORM_SUBMIT_ACTION_ID, FORM_SUBMIT_ATTRIBUTES_KEY, FORM_SUBMIT_EVENT_NAME_KEY } from "com.batch.shared/actions/constants";
export { isFormSubmitAction } from "com.batch.shared/actions/form-submit";

export const RENDER_HOST_ID = "batchsdk-messaging-host";

export const RENDER_FONT_CSS_PROP = "--batch-messaging-font";

export const RENDER_TEXT_KEY_DIALOG_TITLE = "dialogTitle";
export const RENDER_TEXT_KEY_CLOSE_BUTTON = "closeButtonLabel";

/** Reserved `texts` keys; an absent key keeps the built-in English fallback. */
export const RENDER_TEXT_KEY_FORM_REQUIRED_ERROR = "batch.form.error.required";
export const RENDER_TEXT_KEY_FORM_INVALID_ERROR = "batch.form.error.invalid";
export const RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR = "batch.form.error.invalid.email";
export const RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR = "batch.form.error.invalid.phone";
export const RENDER_TEXT_KEY_FORM_INVALID_NUMBER_ERROR = "batch.form.error.invalid.number";
export const RENDER_TEXT_KEY_FORM_INVALID_DATE_ERROR = "batch.form.error.invalid.date";
export const RENDER_TEXT_KEY_FORM_INVALID_URL_ERROR = "batch.form.error.invalid.url";
export const RENDER_TEXT_KEY_FORM_SUBMIT_ERROR = "batch.form.error.submit";
export const RENDER_TEXT_KEY_FORM_NETWORK_ERROR = "batch.form.error.network";
/** Spoken completion status, used when the payload carries no success copy. */
export const RENDER_TEXT_KEY_FORM_COMPLETED_STATUS = "batch.form.status.completed";
export const RENDER_TEXT_KEY_IMAGE_INTERACTIVE = "batch.image.interactive";

/** Native profile slots a serving `mapsTo` can declare. */
export const RENDER_MAPS_TO_EMAIL_ADDRESS = "$email_address";
export const RENDER_MAPS_TO_PHONE_NUMBER = "$phone_number";
export const RENDER_MAPS_TO_TOPIC_PREFERENCES = "$topic_preferences";

/** Reserved decoy `mapsTo`. The request serialization resolves it to the `honeypot` param. */
export const RENDER_MAPS_TO_HONEYPOT = "$honeypot";

/** `name` of the decoy input. It must not match a browser autofill token, or autofill would fill it. */
export const RENDER_HONEYPOT_INPUT_NAME = "subject";

/** Cap on the decoy value, on the control and on the wire, so a pasted value cannot cause a 413. */
export const RENDER_HONEYPOT_MAX_LENGTH = 255;
