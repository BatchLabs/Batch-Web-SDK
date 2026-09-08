import type { MessageAnyComponentModel, MessageModel } from "com.batch.dom/render/model/model";
import {
  FORM_SUBMIT_ACTION_ID,
  isFormSubmitAction,
  RENDER_HONEYPOT_INPUT_NAME,
  RENDER_HONEYPOT_MAX_LENGTH,
  RENDER_LOG_MODULE,
  RENDER_MAPS_TO_HONEYPOT,
  RENDER_TEXT_KEY_FORM_COMPLETED_STATUS,
} from "com.batch.dom/render/render-constants";
import { FormSubmitRuntime, MessageFormController } from "com.batch.dom/render/runtime/form-controller";
import { Log } from "com.batch.shared/logger";

import type { ActionHandler } from "./builder";
import { createElement, resolveMessageText } from "./component-helpers";

/** English fallback of the spoken completion status. `texts` overrides it. */
const DEFAULT_COMPLETED_STATUS = "Form submitted.";

/** Build-time switches the surface passes down. */
export interface FormSetupOptions {
  /** Renders the anti-bot decoy field. Only the landing surface sets it. */
  decoyField?: boolean;
}

/** Form state that the build passes down when the tree carries a form. */
export interface FormRenderContext {
  form: MessageFormController;
  /** Per-render suffix for generated DOM ids: `id`, `for` and `aria-describedby`. */
  domScope: string;
  /** Component id of the submit button, when the tree contains one. */
  submitId?: string;
  /** Submit button element, set by the builder when it renders that button. */
  submitButtonEl: HTMLButtonElement | null;
}

/** Visits every component in the tree depth-first, and descends into columns. */
export function forEachComponent(
  children: (MessageAnyComponentModel | null)[],
  visit: (component: MessageAnyComponentModel) => void
): void {
  for (const child of children) {
    if (!child) continue;
    visit(child);
    if (child.type === "columns") {
      forEachComponent(child.configuration.children, visit);
    }
  }
}

/** Finds the submit button id and whether the tree contains a field. */
export function analyzeFormTree(message: MessageModel): { submitId: string | undefined; hasFields: boolean } {
  const submitIds: string[] = [];
  let hasFields = false;

  forEachComponent(message.root.children, component => {
    if (component.type === "button") {
      const action = message.actions[component.id];
      if (action && isFormSubmitAction(action.action, action.params)) {
        submitIds.push(component.id);
      }
    } else if (component.type === "field") {
      hasFields = true;
    }
  });

  if (submitIds.length > 1) {
    Log.warn(RENDER_LOG_MODULE, `[form] multiple "${FORM_SUBMIT_ACTION_ID}" buttons found, using the first one as submit`);
  }
  const submitId: string | undefined = submitIds[0];
  if (hasFields && submitId === undefined) {
    Log.warn(RENDER_LOG_MODULE, `[form] no submit button found (expected a button with the "${FORM_SUBMIT_ACTION_ID}" action)`);
  }

  return { submitId, hasFields };
}

/** Wires the form runtime when the tree carries a form. Returns undefined when it does not. */
export function createFormSetup(
  message: MessageModel,
  root: HTMLElement,
  onAction: ActionHandler,
  options?: FormSetupOptions
): { context: FormRenderContext; finalize: (root: HTMLElement) => void; dispose: () => void } | undefined {
  const { submitId, hasFields } = analyzeFormTree(message);
  if (submitId === undefined && !hasFields) {
    return undefined;
  }

  const messageNode = createElement("p", "iam-form-message");
  // No author `aria-live`: it would override the role, so a rejected submit would still announce politely.
  messageNode.setAttribute("role", "status");

  // Spoken status, never shown: the spinner and the check mark are decorative.
  const statusNode = createElement("p", "iam-form-status");
  statusNode.setAttribute("role", "status");

  let state: FormState = "idle";

  const applyFormState = (next: FormState): void => {
    if (state === "completed") {
      return;
    }
    state = next;
    root.classList.toggle("iam-form--submitting", next === "submitting");
    root.classList.toggle("iam-form--completed", next === "completed");
    // Disable every control, not only the CTA: the server validates the values the SDK sent.
    setControlsDisabled(root, next !== "idle");

    const busy = next === "submitting" ? "true" : "false";
    root.setAttribute("aria-busy", busy);
    // Read at call time. The builder captures the button after this runtime exists.
    context.submitButtonEl?.setAttribute("aria-busy", busy);
  };

  const runtime: FormSubmitRuntime = {
    setSubmitting(submitting: boolean): void {
      applyFormState(submitting ? "submitting" : "idle");
    },
    showFormMessage(text: string, kind: "success" | "error"): void {
      // A live region only speaks on a mutation, so emptying it first makes a repeated text a real change.
      if (messageNode.textContent === text) {
        messageNode.textContent = "";
      }
      messageNode.textContent = text;
      messageNode.classList.toggle("iam-form-message--success", kind === "success");
      messageNode.classList.toggle("iam-form-message--error", kind === "error");
      messageNode.setAttribute("role", kind === "error" ? "alert" : "status");
      messageNode.classList.add("iam-form-message--visible");
    },
    clearFormMessage(): void {
      messageNode.classList.remove("iam-form-message--visible");
    },
    complete(text?: string): void {
      applyFormState("completed");
      if (text) {
        runtime.showFormMessage(text, "success");
        return;
      }
      statusNode.textContent = resolveMessageText(message.texts, RENDER_TEXT_KEY_FORM_COMPLETED_STATUS, DEFAULT_COMPLETED_STATUS);
    },
  };

  const controller = new MessageFormController(message, submitId, runtime, fields => onAction(submitId ?? "", { formFields: fields }));

  const decoy = options?.decoyField === true && submitId !== undefined ? createDecoyField(controller) : null;

  const context: FormRenderContext = {
    form: controller,
    domScope: Math.random().toString(36).slice(2, 8),
    submitId,
    submitButtonEl: null,
  };

  return {
    context,
    finalize(rootEl: HTMLElement): void {
      // First child, so a bot that fills only the first text input fills the decoy.
      if (decoy) {
        rootEl.insertBefore(decoy, rootEl.firstChild);
      }
      rootEl.appendChild(statusNode);
      if (context.submitButtonEl?.parentElement) {
        context.submitButtonEl.insertAdjacentElement("beforebegin", messageNode);
      } else {
        rootEl.appendChild(messageNode);
      }
    },
    dispose(): void {
      controller.dispose();
    },
  };
}

function createDecoyField(controller: MessageFormController): HTMLInputElement {
  const control = createElement("input", "iam-decoy");
  control.type = "text";
  control.name = RENDER_HONEYPOT_INPUT_NAME;
  control.maxLength = RENDER_HONEYPOT_MAX_LENGTH;
  control.tabIndex = -1;
  control.setAttribute("autocomplete", "off");
  control.setAttribute("aria-hidden", "true");

  controller.register({
    id: RENDER_MAPS_TO_HONEYPOT,
    mapsTo: RENDER_MAPS_TO_HONEYPOT,
    element: control,
    getValue: () => control.value,
    validate: () => null,
    setError: () => undefined,
    focus: () => undefined,
    signalInvalid: () => undefined,
  });

  return control;
}

/** The `completed` state locks the form. The CSS keeps the success message readable and blocks further interaction. */
type FormState = "idle" | "submitting" | "completed";

function setControlsDisabled(root: HTMLElement, disabled: boolean): void {
  root
    .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("button, input, select, textarea")
    .forEach(control => {
      control.disabled = disabled;
    });
}
