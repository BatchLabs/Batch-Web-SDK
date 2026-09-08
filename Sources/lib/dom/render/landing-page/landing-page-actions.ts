import { probeLandingPage } from "com.batch.dom/render/landing-page/landing-page-probe";
import type { LandingSubmitVerdict, LandingTransport } from "com.batch.dom/render/landing-page/landing-transport";
import { clipboardAction, deeplinkAction, groupAction } from "com.batch.shared/actions/builtins";
import { CLIPBOARD_ACTION_ID, DEEPLINK_ACTION_ID, GROUP_ACTION_ID } from "com.batch.shared/actions/constants";
import { MessageActionExecutor } from "com.batch.shared/actions/executor";
import { isSafeURL } from "com.batch.shared/helpers/url";
import { Log } from "com.batch.shared/logger";

import { writeClipboardText } from "../bridge/browser-gateway";
import { ActionOutcome, MessageActionHandler } from "../contracts";
import { FORM_SUBMIT_ACTION_ID } from "../render-constants";

export interface LandingPageActionsConfig {
  /** Input webservice port. Absent means a submit takes the service-unavailable path. */
  transport?: LandingTransport;
  /** `data-error-page-endpoint`: static error page. The host probes it, then navigates to it when the service is unavailable. */
  errorPageEndpoint?: string;
  /** Replaces the landing surface with the bundled error view (rendered by the engine). */
  showEmbeddedErrorPage: () => void;
  /** Test hook. jsdom cannot emulate `location.assign`. Defaults to `window.location.assign`. */
  navigate?: (url: string) => void;
}

/** Builds the action registry a landing page supports: `batch.deeplink`, clipboard, group and form submit. */
export function createLandingPageActionExecutor(config: LandingPageActionsConfig): MessageActionExecutor {
  const executor = new MessageActionExecutor();

  executor.register(DEEPLINK_ACTION_ID, deeplinkAction());
  executor.register(CLIPBOARD_ACTION_ID, clipboardAction(writeClipboardText));
  executor.register(GROUP_ACTION_ID, groupAction(executor));
  executor.register(FORM_SUBMIT_ACTION_ID, makeFormSubmitAction(config));

  return executor;
}

function makeFormSubmitAction(config: LandingPageActionsConfig): MessageActionHandler {
  // One in-place retry keeps the submission id reachable before the outcome page destroys the typed values.
  let retryOffered = false;

  return async (_args, context): Promise<ActionOutcome> => {
    if (!context.formFields) {
      return { kind: "none" };
    }

    let verdict: LandingSubmitVerdict;
    try {
      if (!config.transport) {
        throw new Error("no input transport is wired on this landing page");
      }
      verdict = await config.transport.submitFields(context.formFields);
    } catch (e: unknown) {
      // No verdict came back: missing transport, network failure, unusable response or deadline.
      Log.publicError(`[LandingPage] submit failed: ${e instanceof Error ? e.message : String(e)}`);

      if (config.transport && !retryOffered) {
        retryOffered = true;
        // Throwing hands the form controller its network-error path, keeping the surface and the typed values.
        throw e;
      }

      // Nothing left to retry: the landing host owns the outcome UI.
      await openErrorPage(config);
      // The error status stops a grouped redirect: nothing navigates after a failed submit.
      return { kind: "form-feedback", status: "error" };
    }

    retryOffered = false;
    if (verdict.status === "accepted") {
      // The page stays in place: the engine locks the form and paints the success state.
      return { kind: "form-feedback", status: "success" };
    }

    return { kind: "form-feedback", status: "error", fieldErrors: verdict.fieldErrors };
  };
}

async function openErrorPage(config: LandingPageActionsConfig): Promise<void> {
  const endpoint = config.errorPageEndpoint;
  if (endpoint && isSafeURL(endpoint) && (await probeLandingPage(endpoint))) {
    const navigate = config.navigate ?? (url => window.location.assign(url));
    navigate(endpoint);
    return;
  }
  config.showEmbeddedErrorPage();
}
