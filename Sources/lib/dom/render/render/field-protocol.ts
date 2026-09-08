/** Serializable value a form field contributes to the submit. */
export type MessageFieldValue = string;

/** Protocol a rendered input component exposes to the form controller. */
export interface FormFieldHandle {
  readonly id: string;
  /** Payload key that carries the submitted value; `id` stays the local identifier. */
  readonly mapsTo: string;
  readonly element: HTMLElement;
  getValue(): MessageFieldValue;
  /** Returns `null` when the current value is valid, or the error message to surface. */
  validate(): string | null;
  /** Shows (`string`) or clears (`null`) the field's error UI. */
  setError(message: string | null): void;
  focus(): void;
  /** Plays the rejection animation. Runs once per failed submit, never while typing. */
  signalInvalid(): void;
}
