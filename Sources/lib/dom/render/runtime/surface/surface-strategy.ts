import type { MessageModel } from "com.batch.dom/render/model/model";
import type { ActionHandler } from "com.batch.dom/render/render/builder";

/** Content layout policy a surface can declare: the content column is capped and centered. */
export interface SurfaceContentLayout {
  maxWidth: number;
}

/** Inputs a strategy needs to build a presentation from a normalized message. */
export interface SurfacePresentationParams {
  message: MessageModel;
  contentLayout?: SurfaceContentLayout;
  onUserClose: () => void;
  onAutoClose: () => void;
  onAction: ActionHandler;
}

/** A mounted surface: its root element plus a teardown hook. */
export interface SurfacePresentation {
  element: HTMLElement;
  destroy(): void;
}

/** Defines how a surface presents a rendered message: present, attach, scroll lock and destroy. */
export interface SurfaceStrategy {
  /** Whether the user can dismiss this surface. False for a persistent surface such as the inline landing page. */
  readonly dismissable: boolean;
  /** Content layout this surface grants; absent when the content takes the full width. */
  readonly contentLayout?: SurfaceContentLayout;
  /** Builds the presentation (host element + teardown) for a message. */
  present(params: SurfacePresentationParams): SurfacePresentation;
  /** Attaches the presentation host to the document. */
  attach(host: HTMLElement): void;
  /** Locks the page scroll when required and returns the previous overflow value, or null when it locks nothing. */
  lockScroll(message: MessageModel): string | null;
}
