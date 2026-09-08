import { Log } from "com.batch.shared/logger";

import { InlineLandingSurfaceController } from "./inline-landing-surface-controller";
import type { SurfaceContentLayout, SurfacePresentation, SurfacePresentationParams, SurfaceStrategy } from "./surface-strategy";

/** Presents the rendered message inline in a host-page container, with no scroll lock and no dismiss control. */
export class InlineLandingSurfaceStrategy implements SurfaceStrategy {
  public readonly dismissable = false;

  public constructor(
    private readonly mountSelector: string,
    public readonly contentLayout?: SurfaceContentLayout
  ) {}

  public present(params: SurfacePresentationParams): SurfacePresentation {
    return new InlineLandingSurfaceController(params);
  }

  public attach(host: HTMLElement): void {
    // The served shell ships no stylesheet, so zero the user-agent body margin to reach the viewport edges.
    document.body.style.margin = "0";
    // The selector comes from the served shell, so it can be invalid: `querySelector` throws instead of returning null.
    let mount: Element | null;
    try {
      mount = document.querySelector(this.mountSelector);
    } catch {
      mount = null;
    }

    if (!mount) {
      Log.publicError(`[LandingPage] mount container "${this.mountSelector}" not found; appending to <body>`);
      document.body.appendChild(host);
      return;
    }
    mount.appendChild(host);
  }

  public lockScroll(): string | null {
    return null;
  }
}
