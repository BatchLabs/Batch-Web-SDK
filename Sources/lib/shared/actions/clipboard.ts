import { asString } from "com.batch.shared/helpers/primitive";

/** Parses the `t` and `text` args of `batch.clipboard`. The browser gateway owns the write primitive. */
export function resolveClipboardText(args: Record<string, unknown> | undefined): string {
  const text = asString(args?.["t"]) ?? asString(args?.["text"]);
  if (!text) {
    throw new Error("Cannot copy to clipboard: empty text");
  }
  return text;
}
