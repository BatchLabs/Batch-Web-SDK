/* eslint-env browser */

import { Log, LogLevel } from "com.batch.shared/logger";

import { IS_DEV } from "../../../config";
import { assertBaselineCapabilities } from "../baseline-capabilities";
import { autoInitLandingPage } from "./landing-page";

Log.name = "SDK";
if (IS_DEV) {
  Log.level = LogLevel.Debug;
  Log.enableModule("*");
  Log.disableModule("local-bus");
}

(function main(): void {
  // The served shell loads this bundle directly, so replay the same fail-closed gate.
  if (!assertBaselineCapabilities(message => Log.publicError(message))) {
    return;
  }

  // Only a served page carries the `data-batch-lp` marker; this does nothing elsewhere.
  try {
    autoInitLandingPage();
  } catch (e: unknown) {
    Log.publicError(`[LandingPage] auto-init failed: ${e instanceof Error ? e.message : String(e)}`);
  }
})();
