import { RenderBrowserGateway } from "../contracts";

/** Writes to the native clipboard, throwing on unavailability or denial. */
export async function writeClipboardText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable");
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? `Clipboard write denied: ${e.message}` : "Clipboard write denied";
    throw new Error(message);
  }
}

export class MessageBrowserGateway implements RenderBrowserGateway {
  public openExternalURL(url: string, target: "_self" | "_blank", features: string): void {
    const win = window.open(url, target, features);
    // `noopener` as a window feature only lands in Firefox 68 / Edge 79, below the .browserslistrc floor.
    // Severing `opener` on `_blank` covers every supported browser.
    if (target === "_blank" && win) {
      win.opener = null;
    }
  }
}
