import { RenderHost } from "../contracts";
import { InlineLandingSurfaceStrategy } from "../runtime/surface/inline-landing-surface-strategy";
import { createLandingPageActionExecutor } from "./landing-page-actions";
import { LandingPageAnalyticsSink } from "./landing-page-analytics-sink";
import type { LandingTransport } from "./landing-transport";

export interface LandingPageHostConfig {
  /** Mount point of the rendered page (`data-mount`, e.g. `#batch-lp-root`). */
  mountSelector: string;
  /** Input webservice port. Absent means submits take the service-unavailable path and no analytics leaves the page. */
  transport?: LandingTransport;
  /** Static error page (`data-error-page-endpoint`). The host probes it, then navigates to it when the service is unavailable. */
  errorPageEndpoint?: string;
  /** Replaces the landing surface with the bundled error view (rendered by the engine). */
  showEmbeddedErrorPage: () => void;
}

/** Landing-page host, narrowed to the landing analytics sink. */
export interface LandingPageHost extends RenderHost {
  analyticsSink: LandingPageAnalyticsSink;
}

// Landing pages cap their content column at 960px (PRD "Taille max 960px").
const LANDING_CONTENT_MAX_WIDTH = 960;

export function createLandingPageHost(config: LandingPageHostConfig): LandingPageHost {
  const { mountSelector, transport, errorPageEndpoint, showEmbeddedErrorPage } = config;
  return {
    actions: createLandingPageActionExecutor({ transport, errorPageEndpoint, showEmbeddedErrorPage }),
    analyticsSink: new LandingPageAnalyticsSink(transport),
    surface: new InlineLandingSurfaceStrategy(mountSelector, { maxWidth: LANDING_CONTENT_MAX_WIDTH }),
  };
}
