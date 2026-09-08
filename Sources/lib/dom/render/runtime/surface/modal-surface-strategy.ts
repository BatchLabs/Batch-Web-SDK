import type { MessageModel } from "com.batch.dom/render/model/model";
import { MessageSurfaceController } from "com.batch.dom/render/runtime/surface-controller";

import type { SurfacePresentation, SurfacePresentationParams, SurfaceStrategy } from "./surface-strategy";

/** Presents messages as in-app overlays: modal, banner or fullscreen. The default surface. */
export class ModalSurfaceStrategy implements SurfaceStrategy {
  public readonly dismissable = true;

  public present(params: SurfacePresentationParams): SurfacePresentation {
    return new MessageSurfaceController(params);
  }

  public attach(host: HTMLElement): void {
    document.body.prepend(host);
  }

  public lockScroll(message: MessageModel): string | null {
    if (message.format === "modal" && message.position === "center") {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return previous;
    }

    return null;
  }
}
