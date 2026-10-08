import type { FormFieldValue } from "com.batch.shared/actions/contracts";

/** Protocol a rendered input component exposes to the form controller. */
export interface FormFieldHandle {
  readonly id: string;
  /** Payload key that carries the submitted value; `id` stays the local identifier. Absent means the value is validated, never collected. */
  readonly mapsTo: string | undefined;
  readonly element: HTMLElement;
  /** `null` when the control holds nothing it can carry. */
  getValue(): FormFieldValue | null;
  /** Returns `null` when the current value is valid, or the error message to surface. */
  validate(): string | null;
  /** Shows (`string`) or clears (`null`) the field's error UI. */
  setError(message: string | null): void;
  focus(): void;
  /** Plays the rejection animation. Runs once per failed submit, never while typing. */
  signalInvalid(): void;
}
