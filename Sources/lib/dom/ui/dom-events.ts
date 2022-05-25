export enum BatchDomEvent {
  VisibilityChanged = "visibilityChanged",
}

export type AnyEvent = BatchDomEvent | keyof ElementEventMap | keyof HTMLElementEventMap | keyof SVGElementEventMap;
