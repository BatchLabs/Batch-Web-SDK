/* eslint-env browser */

export const LANDING_MARKER_SELECTOR = 'script[type="application/json"][data-batch-lp]';

/** Resolves the landing-page definition marker, or null when the page did not opt in. */
export function resolveLandingPageMarker(): HTMLScriptElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector<HTMLScriptElement>(LANDING_MARKER_SELECTOR);
}
