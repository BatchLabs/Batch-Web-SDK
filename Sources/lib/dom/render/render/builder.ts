import type { ActionContext, ActionOutcome } from "com.batch.dom/render/contracts";
import type { MessageAnyComponentModel, MessageModel } from "com.batch.dom/render/model/model";

import { renderButton, renderSubmitButton } from "./components/button";
import { renderColumns } from "./components/columns";
import { renderDivider } from "./components/divider";
import { renderImage } from "./components/image";
import { renderInput } from "./components/input";
import { renderLabel } from "./components/label";
import { renderSpacer } from "./components/spacer";
import { applyHideOn } from "./dom-utils";
import { createFormSetup, FormRenderContext, FormSetupOptions } from "./form-setup";

/** Handles a component action. On a submit, the context carries the collected form fields. */
export type ActionHandler = (componentId: string, context?: ActionContext) => Promise<ActionOutcome>;

/** Builds the root component tree. */
export function buildComponentTree(
  message: MessageModel,
  onAction: ActionHandler,
  registerFormDispose?: (dispose: () => void) => void,
  options?: FormSetupOptions
): HTMLElement {
  const root = document.createElement("div");
  root.className = "iam-root";

  const setup = createFormSetup(message, root, onAction, options);

  for (const child of message.root.children) {
    const el = renderComponent(child, message, onAction, setup?.context);
    if (el) root.appendChild(el);
  }

  if (setup) {
    setup.finalize(root);
    registerFormDispose?.(setup.dispose);
  }

  return root;
}

function renderComponent(
  component: MessageAnyComponentModel,
  message: MessageModel,
  onAction: ActionHandler,
  context?: FormRenderContext
): HTMLElement | null {
  const el = renderComponentElement(component, message, onAction, context);
  if (el && "hideOn" in component) {
    applyHideOn(el, component.hideOn);
  }
  return el;
}

function renderComponentElement(
  component: MessageAnyComponentModel,
  message: MessageModel,
  onAction: ActionHandler,
  context?: FormRenderContext
): HTMLElement | null {
  switch (component.type) {
    case "text":
      return renderLabel(component, message);
    case "button": {
      const form = context?.form;
      if (form && component.id === context.submitId) {
        const el = renderSubmitButton(component, message, () => {
          if (!form.acceptsSubmit) {
            return;
          }
          // Reported before local validation: a submit blocked by an invalid field is still a click.
          void Promise.resolve(onAction(component.id, { formClick: { values: form.collectAttributes() } })).catch(() => undefined);
          void form.submit();
        });
        context.submitButtonEl = el;
        return el;
      }
      return renderButton(component, message, onAction);
    }
    case "image":
      return renderImage(component, message, onAction);
    case "divider":
      return renderDivider(component);
    case "spacer":
      return renderSpacer(component);
    case "columns":
      return renderColumns(component, child => renderComponent(child, message, onAction, context));
    case "field":
      return context ? renderInput(component, message, context) : null;
    default:
      return null;
  }
}
