/* eslint-env browser */

import { Log } from "com.batch.shared/logger";

import { IS_WEBPACK_DEV_SERVER, SDK_VERSION, SSL_SCRIPT_URL } from "../../../config";
import { resolveLandingPageMarker } from "./marker";

const logModuleName = "landing-page-loader";

/** Detects a landing page from the `data-batch-lp` marker and injects `landing-page.min.js`. */
export function autoDetectLandingPage(): void {
  if (typeof document === "undefined") {
    return;
  }

  if (!injectIfMarkerPresent() && document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        injectIfMarkerPresent();
      },
      { once: true }
    );
  }
}

function injectIfMarkerPresent(): boolean {
  const marker = resolveLandingPageMarker();
  if (!marker) {
    Log.debug(logModuleName, "No landing definition marker on this page");
    return false;
  }

  // Double-injection guards: another loader instance, or the served fast path.
  if (marker.dataset.batchLpLoader !== undefined) {
    Log.debug(logModuleName, "Landing bundle already claimed by another loader");
    return true;
  }
  if (document.querySelector("script[src*='landing-page.min.js']")) {
    Log.debug(logModuleName, "Landing bundle already on the page");
    return true;
  }
  marker.dataset.batchLpLoader = "injected";

  // Same URL resolution as the ui components: dev-server origin, or the versioned CDN path.
  const url = IS_WEBPACK_DEV_SERVER
    ? `${document.location.origin}/landing-page.min.js`
    : `https://${SSL_SCRIPT_URL}/${SDK_VERSION}/landing-page.min.js`;

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = url;
  tag.onerror = () => {
    Log.publicError(`[LandingPage] failed to load ${url}`);
  };

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(tag, firstScript);
  } else {
    document.head.appendChild(tag);
  }

  Log.info(logModuleName, "Landing definition marker found, loading", url);
  return true;
}
