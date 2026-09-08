import { makeEmbeddedErrorPayload } from "com.batch.dom/render/landing-page/embedded-outcome-pages";
import { createLandingInputTransport } from "com.batch.dom/render/landing-page/input-transport";
import { createLandingPageHost, LandingPageHost } from "com.batch.dom/render/landing-page/landing-page-host";
import { landingDefaultTexts, resolveLandingPageLang } from "com.batch.dom/render/landing-page/landing-page-l10n";
import { createLandingPreviewTransport } from "com.batch.dom/render/landing-page/preview-transport";
import { MessagePayload } from "com.batch.dom/render/model/types";
import { MessageRenderer } from "com.batch.dom/render/renderer";
import { Log } from "com.batch.shared/logger";

import { resolveLandingPageMarker } from "./marker";

const DEFAULT_MOUNT_SELECTOR = "#batch-lp-root";

/** Inert serving envelope holding the localized message. Serving metadata travels in `payload.eventData`. */
interface LandingPageEnvelope {
  payload: MessagePayload;
}

function readEnvelope(marker: HTMLScriptElement): LandingPageEnvelope | null {
  if (!marker.textContent) {
    Log.publicError("[LandingPage] the landing definition element is empty");
    return null;
  }

  try {
    const parsed = JSON.parse(marker.textContent) as Partial<LandingPageEnvelope> | null;
    if (!parsed || typeof parsed !== "object" || parsed.payload == null) {
      Log.publicError("[LandingPage] the landing definition is missing a payload");
      return null;
    }
    return { payload: parsed.payload };
  } catch (e: unknown) {
    Log.publicError(`[LandingPage] the landing definition is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function bootstrapLandingPage(marker: HTMLScriptElement): Promise<void> {
  const inputEndpoint = marker.dataset.inputEndpoint;
  if (!inputEndpoint) {
    Log.publicError("[LandingPage] missing data-input-endpoint on the landing definition element");
    return;
  }

  const envelope = readEnvelope(marker);
  if (!envelope) {
    return;
  }

  // The built-in strings merge under the payload's own texts, so serving keys win.
  const lang = resolveLandingPageLang(marker.dataset.lang);
  envelope.payload.texts = { ...landingDefaultTexts(lang), ...envelope.payload.texts };

  // Late-bound: the host config captures this closure before the host and the renderer exist.
  let host: LandingPageHost | null = null;
  let renderer: MessageRenderer | null = null;
  const showEmbeddedErrorPage = (): void => {
    // Mute before the render: the SDK-owned error view must produce no analytics.
    host?.analyticsSink.mute();
    renderer?.show(makeEmbeddedErrorPayload(lang)).catch((e: unknown) => {
      Log.publicError(`[LandingPage] could not render the embedded error page: ${e instanceof Error ? e.message : String(e)}`);
    });
  };

  // Read it with `hasAttribute`: through `dataset` a bare attribute reads back as the empty string.
  const previewMode = marker.hasAttribute("data-submit-mode-preview");

  host = createLandingPageHost({
    mountSelector: marker.dataset.mount?.trim() || DEFAULT_MOUNT_SELECTOR,
    transport: previewMode
      ? createLandingPreviewTransport({ inputEndpoint, eventData: envelope.payload.eventData ?? {} })
      : createLandingInputTransport({
          inputEndpoint,
          eventData: envelope.payload.eventData ?? {},
          // Post-merge texts, so serving overrides also win on the server field errors.
          texts: envelope.payload.texts ?? {},
        }),
    errorPageEndpoint: marker.dataset.errorPageEndpoint,
    showEmbeddedErrorPage,
  });
  renderer = new MessageRenderer(host);

  try {
    await renderer.show(envelope.payload);
  } catch (e: unknown) {
    Log.publicError(`[LandingPage] render failed: ${e instanceof Error ? e.message : String(e)}`);
    showEmbeddedErrorPage();
  }
}

export { resolveLandingPageMarker } from "./marker";

/** Landing-page auto-init entry: resolves the marker, waiting for `DOMContentLoaded`, and boots once. */
export function autoInitLandingPage(): void {
  if (typeof document === "undefined") {
    return;
  }

  const boot = (): void => {
    const marker = resolveLandingPageMarker();
    if (!marker) {
      Log.publicError("[LandingPage] no data-batch-lp definition marker found: nothing to render");
      return;
    }
    if (marker.dataset.batchLpState !== undefined) {
      Log.publicError("[LandingPage] already initialized, ignoring duplicate init");
      return;
    }
    marker.dataset.batchLpState = "booting";
    void bootstrapLandingPage(marker);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
