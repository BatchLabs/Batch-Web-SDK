import { ctaTypeForComponentId, MessageAnalyticsWrapper, MessageCloseErrorCause } from "com.batch.dom/render/analytics/analytics-wrapper";
import { MessageBrowserGateway } from "com.batch.dom/render/bridge/browser-gateway";
import { MessageModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { isMessageFormat, MessagePayload } from "com.batch.dom/render/model/types";
import { FORM_SUBMIT_ACTION_ID } from "com.batch.dom/render/render-constants";
import { ActionHandler } from "com.batch.dom/render/render/builder";
import { MessageFontManager } from "com.batch.dom/render/runtime/font-manager";
import { DismissEvent, trackDismiss } from "com.batch.dom/render/runtime/renderer-dismiss";
import { applyThemeToHost, MessageThemeMode, normalizeThemeMode } from "com.batch.dom/render/runtime/theme-resolver";
import { resolveCTAValue } from "com.batch.shared/actions/resolve/cta-value";
import { Log } from "com.batch.shared/logger";

import { ActionContext, ActionOutcome, RenderActionRegistry, RenderAnalyticsSink, RenderBrowserGateway, RenderHost } from "./contracts";
import type { SurfaceStrategy } from "./runtime/surface/surface-strategy";

interface ActivePresentation {
  host: HTMLElement;
  destroy(): void;
  previousFocus: Element | null;
  bodyOverflowToRestore: string | null;
}

export class MessageRenderer {
  private readonly browserGateway: RenderBrowserGateway = new MessageBrowserGateway();
  private readonly analyticsSink: RenderAnalyticsSink;
  private readonly surface: SurfaceStrategy;
  private readonly fontManager = new MessageFontManager();
  private readonly actionExecutor: RenderActionRegistry;
  private active: ActivePresentation | null = null;
  private themeMode: MessageThemeMode = "auto";
  private analytics: MessageAnalyticsWrapper | null = null;

  public constructor(dependencies: RenderHost) {
    this.analyticsSink = dependencies.analyticsSink;
    this.surface = dependencies.surface;
    this.actionExecutor = dependencies.actions;
  }

  /** Replaces any currently displayed message. Rejects a payload whose `format` is not supported. */
  public async show(payload: MessagePayload): Promise<void> {
    if (!isMessageFormat(payload.format)) {
      throw new Error(`Invalid Message payload: unsupported format "${String(payload.format)}"`);
    }

    if (this.active) {
      this.dismiss({ reason: "api_hide" });
    }

    const previousFocus = document.activeElement;
    const message = this._initializeMessage(payload);

    try {
      this._showSurface(message, previousFocus);
      this.analytics?.trackDisplayed();
    } catch (e) {
      this.analytics?.trackCloseError(MessageCloseErrorCause.Unknown);
      this.analytics?.trackDismissed();
      this._remove();
      throw e;
    }
  }

  /** Dismisses the mounted message as an API-driven close. */
  public hide(): void {
    this.dismiss({ reason: "api_hide" });
  }

  /** Sets the font family the surface host carries. */
  public setFontFamily(family: string | null): void {
    this.fontManager.setFamily(this.active?.host ?? null, family);
  }

  /** Updates the theme mode and applies it to the mounted host. */
  public setTheme(mode: MessageThemeMode): void {
    this.themeMode = normalizeThemeMode(mode);
    if (this.active) {
      applyThemeToHost(this.active.host, this.themeMode);
    }
  }

  /** Registers a named custom action. A native CTA can trigger it. */
  public registerAction(name: string, handler: (args: Record<string, unknown>) => ActionOutcome | Promise<ActionOutcome>): void {
    this.actionExecutor.registerAction(name, handler);
  }

  public unregisterAction(name: string): void {
    this.actionExecutor.unregisterAction(name);
  }

  private dismiss(event: DismissEvent): void {
    trackDismiss(this.analytics, event);
    this._remove();
  }

  private _remove(): void {
    const active = this.active;
    this.active = null;
    this.analytics = null;

    if (!active) {
      return;
    }

    // Keep this order: restore the page scroll, destroy the runtime, then restore focus.
    if (active.bodyOverflowToRestore !== null) {
      document.body.style.overflow = active.bodyOverflowToRestore;
    }
    active.destroy();
    (active.previousFocus as HTMLElement | null)?.focus?.();
  }

  private _showSurface(message: MessageModel, previousFocus: Element | null): void {
    const presentation = this.surface.present({
      message,
      contentLayout: this.surface.contentLayout,
      onUserClose: () => this.dismiss({ reason: "user_close" }),
      onAutoClose: () => this.dismiss({ reason: "auto_close" }),
      onAction: this._createComponentActionHandler(message),
    });
    // Register the presentation before attaching: an `_attachHost` failure would otherwise leak the runtime listeners and timer.
    this.active = {
      host: presentation.element,
      destroy: () => presentation.destroy(),
      previousFocus,
      bodyOverflowToRestore: this.surface.lockScroll(message),
    };
    this._attachHost(presentation.element);
  }

  private _createComponentActionHandler(message: MessageModel): ActionHandler {
    return async (componentId, context) => {
      // A form submit rejection must reach the form controller error path: do not catch it here.
      if (context?.formFields) {
        return this._handleComponentAction(message, componentId, context);
      }
      try {
        return await this._handleComponentAction(message, componentId, context);
      } catch (e: unknown) {
        Log.publicError(`[Message] Unhandled error during message action: ${e instanceof Error ? e.message : String(e)}`);
        if (this.surface.dismissable) {
          this.dismiss({ reason: "error", cause: MessageCloseErrorCause.Unknown });
        }
        return { kind: "none" };
      }
    };
  }

  private async _handleComponentAction(message: MessageModel, componentId: string, context?: ActionContext): Promise<ActionOutcome> {
    const action = message.actions[componentId];
    const ctaType = ctaTypeForComponentId(message, componentId);
    const actionName = action?.action;

    // Reports the submit tap before local validation, as on the natives, under `batch.form.submit`.
    if (context?.formClick) {
      this.analytics?.trackClicked(componentId, ctaType, FORM_SUBMIT_ACTION_ID, context.formClick.values);
      return { kind: "none" };
    }

    if (context?.formFields) {
      const feedback = await this.actionExecutor.execute({ action: actionName ?? "", args: action?.params }, context);
      // The navigation commits asynchronously, so the form still paints its success state before the page leaves.
      if (feedback.kind === "form-feedback" && feedback.status === "success" && feedback.openWindow) {
        this._applyImmediateActionExecution({ kind: "open_window", openWindow: feedback.openWindow });
      }
      return feedback;
    }

    if (!action || action.action === "dismiss" || action.action === "batch.dismiss") {
      this.analytics?.trackClicked(componentId, ctaType, actionName);
      this._dismissCta(componentId, ctaType, actionName);
      return { kind: "none" };
    }

    this.analytics?.trackClicked(componentId, ctaType, actionName, resolveCTAValue(actionName, action.params));
    try {
      const execution = await this.actionExecutor.execute({
        action: action.action,
        args: action.params,
      });
      this._dismissCta(componentId, ctaType, actionName);
      this._applyImmediateActionExecution(execution);
    } catch (e: unknown) {
      Log.publicError(`Message action '${actionName ?? "unknown"}' failed: ${e instanceof Error ? e.message : "unknown error"}`);
      if (this.surface.dismissable) {
        this.dismiss({ reason: "error", cause: MessageCloseErrorCause.Unknown });
      }
    }
    return { kind: "none" };
  }

  private _dismissCta(componentId: string, ctaType: ReturnType<typeof ctaTypeForComponentId>, actionName: string | undefined): void {
    if (!this.surface.dismissable) {
      return;
    }
    this.dismiss({ reason: "cta", ctaId: componentId, ctaType, action: actionName });
  }

  private _applyImmediateActionExecution(execution: ActionOutcome): void {
    if (execution.kind === "open_window") {
      this.browserGateway.openExternalURL(execution.openWindow.url, execution.openWindow.target, execution.openWindow.features);
    }
  }

  private _initializeMessage(payload: MessagePayload): MessageModel {
    const message = normalizeMessage(payload);
    this.analytics = new MessageAnalyticsWrapper(message, event => {
      this.analyticsSink.emit(event);
    });
    return message;
  }

  private _attachHost(host: HTMLElement): void {
    applyThemeToHost(host, this.themeMode);
    this.fontManager.applyToHost(host);
    this.surface.attach(host);
  }
}
