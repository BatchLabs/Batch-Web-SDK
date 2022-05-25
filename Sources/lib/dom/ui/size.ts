import { IDOMElementStyle } from "./dom";

export class Position {
  public left: number;
  public top: number;

  public constructor(left: number, top: number) {
    this.left = left;
    this.top = top;
  }

  public toString(): string {
    return "left=" + this.left + "px,top=" + this.top + "px";
  }

  public asStyle(): IDOMElementStyle {
    return { left: this.left + "px", top: this.top + "px" };
  }
}

export class Dimension {
  public width: number;
  public height: number;

  public constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Returns a position if an hypothetic box representing by this dimension
   * was centered into the given rectangle
   */
  public centerIn(box: Rectangle): Position {
    const dim = box.dim;
    const pos = box.pos;

    const l = this.width < dim.width ? dim.width / 2 - this.width / 2 : 0;
    const t = this.height < dim.height ? dim.height / 2 - this.height / 2 : 0;

    return new Position(l + pos.left, t + pos.top);
  }

  public toString(): string {
    return "width=" + this.width + "px,height=" + this.height + "px";
  }
}

export class Rectangle {
  public pos: Position;
  public dim: Dimension;

  public constructor(pos: Position, dim: Dimension) {
    this.pos = pos;
    this.dim = dim;
  }

  public toString(): string {
    return this.pos.toString() + "," + this.dim.toString();
  }

  public top(): number {
    return this.pos.top;
  }

  public left(): number {
    return this.pos.left;
  }

  public right(): number {
    return this.pos.left + this.dim.width;
  }

  public bottom(): number {
    return this.pos.top + this.dim.height;
  }

  public width(): number {
    return this.dim.width;
  }

  public height(): number {
    return this.dim.height;
  }
}

// ----------------------------------->

/**
 * Returns the screen position
 */
export function screenPos(): Position {
  if (typeof window.screenLeft === "undefined" || typeof window.screenTop === "undefined") {
    return new Position(window.screenX, window.screenY);
  }

  return new Position(window.screenLeft, window.screenTop);
}

/**
 * Returns the screen width
 */
export function screenDim(): Dimension {
  return new Dimension(screen.width, screen.height);
}

/**
 * Returns the window dimension
 * Returns the screen width by default
 */
export function windowDim(): Dimension {
  if (window.innerWidth || window.innerHeight) {
    return new Dimension(window.innerWidth, window.innerHeight);
  }

  if (document.documentElement != null) {
    const el: HTMLElement = document.documentElement;
    if (el.clientWidth && el.clientHeight) {
      return new Dimension(el.clientWidth, el.clientHeight);
    }
  }

  return screenDim();
}

export function windowBox(): Rectangle {
  return new Rectangle(screenPos(), windowDim());
}

export function fromClientRect(rect: ClientRect): Rectangle {
  const pos = new Position(rect.left, rect.top);
  const dim = new Dimension(rect.right - rect.left, rect.bottom - rect.top);
  return new Rectangle(pos, dim);
}

export function sizeOfElement(element: Element): Rectangle {
  return fromClientRect(element.getBoundingClientRect());
}
