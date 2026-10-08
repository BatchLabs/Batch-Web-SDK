import type { ActionOutcome, FormFieldValue } from "com.batch.dom/render/contracts";
import type { MessageModel } from "com.batch.dom/render/model/model";
import {
  RENDER_LOG_MODULE,
  RENDER_TEXT_KEY_FORM_NETWORK_ERROR,
  RENDER_TEXT_KEY_FORM_SUBMIT_ERROR,
} from "com.batch.dom/render/render-constants";
import { resolveMessageText } from "com.batch.dom/render/render/component-helpers";
import type { FormFieldHandle } from "com.batch.dom/render/render/field-protocol";
import { Log } from "com.batch.shared/logger";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

const DEFAULT_SUBMIT_ERROR_MESSAGE = "Something went wrong. Please try again.";
const DEFAULT_NETWORK_ERROR_MESSAGE = "We couldn't reach the server. Please try again.";

export type { FormFieldHandle } from "com.batch.dom/render/render/field-protocol";

interface FieldEntry {
  handle: FormFieldHandle;
  error: string | null;
  touched: boolean;
}

/** `undefined` when the value carries nothing: a blank string, or a partial update with two empty branches. `false` is information and lands. */
function collectableValue(value: FormFieldValue | null): FormFieldValue | undefined {
  if (value === null) {
    return undefined;
  }
  switch (value.type) {
    case ProfileAttributeType.STRING: {
      const trimmed = value.value.trim();
      return trimmed.length > 0 ? { type: ProfileAttributeType.STRING, value: trimmed } : undefined;
    }
    case ProfileAttributeType.ARRAY:
      return (value.value.$add?.length ?? 0) + (value.value.$remove?.length ?? 0) > 0 ? value : undefined;
    default:
      return value;
  }
}

/** DOM-facing feedback hooks the rendered surface implements for the form controller. */
export interface FormSubmitRuntime {
  setSubmitting(submitting: boolean): void;
  showFormMessage(message: string, kind: "success" | "error"): void;
  clearFormMessage(): void;
  /** Renders the success confirmation and locks the form (completion block). */
  complete(message?: string): void;
}

/** Resolves the submit CTA outside the engine with the collected field values. */
export type FormSubmitResolver = (fields: Record<string, FormFieldValue>) => Promise<ActionOutcome>;

/** Holds the live state of the fields collected across the rendered tree. Validation shows errors only from the submit. */
export class MessageFormController {
  private readonly entries: FieldEntry[] = [];
  private readonly byId = new Map<string, FieldEntry>();
  private submitting = false;
  private completed = false;
  private disposed = false;

  public constructor(
    private readonly message: MessageModel,
    private readonly submitActionRef: string | undefined,
    private readonly runtime: FormSubmitRuntime,
    private readonly resolveSubmit: FormSubmitResolver
  ) {}

  public register(handle: FormFieldHandle): void {
    if (this.byId.has(handle.id)) {
      Log.warn(RENDER_LOG_MODULE, `[form] duplicate field id "${handle.id}": errors and input events reach the last one only`);
    }
    const entry: FieldEntry = { handle, error: null, touched: false };
    this.entries.push(entry);
    this.byId.set(handle.id, entry);
  }

  public handleInput(id: string): void {
    const entry = this.byId.get(id);
    if (!entry) {
      return;
    }
    entry.touched = true;
    // While typing, only clear or refresh an error already shown; never raise a new one.
    if (entry.error === null) {
      return;
    }
    this.revalidate(entry);
  }

  /** Validates on blur, but only a field the user has already edited. */
  public handleBlur(id: string): void {
    const entry = this.byId.get(id);
    if (!entry || !entry.touched) {
      return;
    }
    this.revalidate(entry);
  }

  public validateAll(): boolean {
    let valid = true;
    let firstInvalid: FieldEntry | null = null;
    for (const entry of this.entries) {
      if (!this.revalidate(entry)) {
        valid = false;
        if (!firstInvalid) {
          firstInvalid = entry;
        }
      }
    }
    if (firstInvalid) {
      firstInvalid.handle.focus();
      firstInvalid.handle.signalInvalid();
    }
    return valid;
  }

  public collectAttributes(): Record<string, FormFieldValue> {
    return this.entries.reduce<Record<string, FormFieldValue>>((acc, entry) => {
      const mapsTo = entry.handle.mapsTo;
      if (mapsTo === undefined || mapsTo.length === 0) {
        return acc;
      }
      const collected = collectableValue(entry.handle.getValue());
      if (collected === undefined) {
        return acc;
      }
      if (Object.prototype.hasOwnProperty.call(acc, mapsTo)) {
        Log.warn(RENDER_LOG_MODULE, `[form] dropped field "${entry.handle.id}": duplicate mapsTo "${mapsTo}"`);
        return acc;
      }
      acc[mapsTo] = collected;
      return acc;
    }, {});
  }

  /** Whether a tap on the submit CTA is a live activation: not submitting, not completed, not disposed, and the CTA has an action. */
  public get acceptsSubmit(): boolean {
    return this.submitActionRef !== undefined && !this.submitting && !this.completed && !this.disposed;
  }

  /** Detaches the controller so an in-flight submit stops before writing into a removed DOM. */
  public dispose(): void {
    this.disposed = true;
  }

  /** Validates locally, resolves the submit CTA, then paints and locks on success or shows the per-field errors. */
  public async submit(): Promise<void> {
    if (!this.acceptsSubmit) {
      return;
    }
    if (!this.validateAll()) {
      return;
    }

    this.submitting = true;
    this.runtime.clearFormMessage();
    this.runtime.setSubmitting(true);

    let outcome: ActionOutcome | null = null;
    let failure: unknown;
    try {
      outcome = await this.resolveSubmit(this.collectAttributes());
    } catch (e: unknown) {
      failure = e;
    }
    this.submitting = false;

    // The surface can be removed mid-request by the auto-close timer, so a disposed controller stops here.
    if (this.disposed) {
      return;
    }
    this.runtime.setSubmitting(false);

    if (outcome == null) {
      Log.warn(RENDER_LOG_MODULE, "[form] submit failed:", failure instanceof Error ? failure.message : String(failure));
      this.runtime.showFormMessage(
        resolveMessageText(this.message.texts, RENDER_TEXT_KEY_FORM_NETWORK_ERROR, DEFAULT_NETWORK_ERROR_MESSAGE),
        "error"
      );
      return;
    }

    if (outcome.kind !== "form-feedback") {
      Log.warn(RENDER_LOG_MODULE, `[form] submit resolved to an unexpected "${outcome.kind}" outcome`);
      this.runtime.showFormMessage(
        resolveMessageText(this.message.texts, RENDER_TEXT_KEY_FORM_SUBMIT_ERROR, DEFAULT_SUBMIT_ERROR_MESSAGE),
        "error"
      );
      return;
    }

    if (outcome.status === "success") {
      this.completed = true;
      this.runtime.complete(outcome.message);
      return;
    }

    const firstRejected = this.applyFieldErrors(outcome.fieldErrors);
    if (outcome.message !== undefined) {
      this.runtime.showFormMessage(outcome.message, "error");
      return;
    }
    if (firstRejected !== null) {
      firstRejected.handle.focus();
      firstRejected.handle.signalInvalid();
      return;
    }
    if (outcome.fieldErrors !== undefined) {
      Log.warn(
        RENDER_LOG_MODULE,
        "[form] none of the server field errors matched a rendered field: falling back to the generic submit error"
      );
    }
    this.runtime.showFormMessage(
      resolveMessageText(this.message.texts, RENDER_TEXT_KEY_FORM_SUBMIT_ERROR, DEFAULT_SUBMIT_ERROR_MESSAGE),
      "error"
    );
  }

  private applyFieldErrors(fieldErrors: Record<string, string> | undefined): FieldEntry | null {
    if (!fieldErrors) {
      return null;
    }
    let firstRejected: FieldEntry | null = null;
    for (const [id, message] of Object.entries(fieldErrors)) {
      const entry = this.byId.get(id);
      if (entry) {
        entry.error = message;
        entry.handle.setError(message);
        firstRejected ??= entry;
      }
    }
    return firstRejected;
  }

  private revalidate(entry: FieldEntry): boolean {
    const error = entry.handle.validate();
    entry.error = error;
    entry.handle.setError(error);
    return error === null;
  }
}
