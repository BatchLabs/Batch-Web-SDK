import { FORM_SUBMIT_ACTION_ID, GROUP_ACTION_ID } from "./constants";
import { resolveGroupedActions } from "./resolve/group";

/** Tells whether a CTA action is `batch.form.submit`, or a `batch.group` that chains it. */
export function isFormSubmitAction(action: string | undefined, args: Record<string, unknown> | undefined): boolean {
  const name = action?.trim().toLowerCase();
  if (name === FORM_SUBMIT_ACTION_ID) {
    return true;
  }
  if (name !== GROUP_ACTION_ID || !Array.isArray(args?.["actions"])) {
    return false;
  }
  return resolveGroupedActions(args).some(grouped => grouped.action.trim().toLowerCase() === FORM_SUBMIT_ACTION_ID);
}
