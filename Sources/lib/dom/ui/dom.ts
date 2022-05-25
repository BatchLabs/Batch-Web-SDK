import { AnyEvent } from "./dom-events";
import { Dimension, Position, Rectangle, sizeOfElement } from "./size";

export interface IDOMElementStyle {
  [key: string]: string | null;
}

// See isHTMLElement for an explanation of what this is used for
const realHTMLElementPrototype = Object.getPrototypeOf(Object.getPrototypeOf(document.createElement("span")));

function isHTMLElement(e: Element): e is HTMLElement {
  // Work around an issue where AMP polyfills HTMLElement and thus "instanceof HTMLElement" doesn't work
  // The trick is to get the "real" HTMLElement prototype and check if the element is an instance of that prototype
  //
  // Also, Typescript doesn't understand __proto__
  return Object.prototype.isPrototypeOf.call(realHTMLElementPrototype, Object.getPrototypeOf(e));
}

/**
 * List of elements
 */
export class DOMElement {
  public static EMPTY = new DOMElement([]);
  /**
   * The wrapped array of elements
   * FIXME using an array is not the most performance
   * we should use an iterator of (elements, one element, NodeList ...) and use iteration methods
   */
  public wrapped: Element[];

  /**
   * The array of DOMElement
   */
  public doms?: DOMElement[];

  // ----------------------------------->

  public constructor(elems: Element[]) {
    this.wrapped = elems;
  }

  // ----------------------------------->

  public toArray(): DOMElement[] {
    if (this.doms != null) {
      return this.doms;
    }

    this.doms = this.wrapped.map(e => DOMElement.from(e));
    return this.doms;
  }

  /**
   * Filter html elements
   */
  public filterHTML(): HTMLElement[] {
    return this.wrapped.filter(isHTMLElement);
  }

  /**
   * Filter svg elements
   */
  public filterSVG(): SVGElement[] {
    return this.wrapped.filter((e => e instanceof SVGElement) as (e: Element) => e is SVGElement);
  }

  // ----------------------------------->

  public elem(): Element | undefined {
    return this.wrapped[0];
  }

  public elems(): Element[] {
    return this.wrapped;
  }

  // ----------------------------------->

  /**
   * Determines whether the first element is one of the given elements
   * Comparing DOMElement.EMPTY elements will always return false.
   */
  public is(d: DOMElement): boolean {
    const e = this.elem();
    if (e === undefined || d.length() === 0) {
      return false;
    }

    return d.someElem(el => el === e);
  }

  /**
   * Concat this DOMElement with the given one
   * and return a new one
   */
  public concat(d: DOMElement): DOMElement {
    return new DOMElement(this.wrapped.concat(d.wrapped));
  }

  // ----------------------------------->
  // Navigate

  public getById(id: string): DOMElement {
    return DOMElement.from(document.getElementById(id));
  }

  /**
   * Returns the first child element of each HMLElement that match the given selector
   */
  public selectOne(selector: string): DOMElement {
    const a = this.wrapped.map(e => e.querySelector(selector));
    return DOMElement.from(a.filter(e => e != null));
  }

  /**
   * Returns the all child element of each HMLElement that match the given selector
   */
  public select(selector: string): DOMElement {
    const a: Element[] = DOMElement.flattern(this.wrapped.map(e => e.querySelectorAll(selector)));
    return DOMElement.from(a);
  }

  public getByTag(tag: string): DOMElement {
    const a: Element[] = DOMElement.flattern(this.wrapped.map(e => e.getElementsByTagName(tag)));
    return DOMElement.from(a);
  }

  public getByClass(className: string): DOMElement {
    const a: Element[] = DOMElement.flattern(this.wrapped.map(e => e.getElementsByClassName(className)));
    return DOMElement.from(a);
  }

  public parent(): DOMElement {
    return DOMElement.from(this.wrapped.map(e => e.parentElement).filter(e => e != null));
  }

  public closest(selector: string): DOMElement {
    return DOMElement.from(this.wrapped.map(e => e.closest(selector)).filter(e => e != null));
  }

  // ----------------------------------->
  // Accessors

  public empty(): boolean {
    return this.wrapped.length === 0;
  }

  public length(): number {
    return this.wrapped.length;
  }

  public first(): DOMElement {
    return DOMElement.from(this.doms != null ? this.doms[0] : this.wrapped[0]);
  }

  public last(): DOMElement {
    return DOMElement.from(this.doms != null ? this.doms[this.wrapped.length - 1] : this.wrapped[this.wrapped.length - 1]);
  }

  public forEach(callback: (value: DOMElement, index: number, array: DOMElement[]) => void): DOMElement {
    this.toArray().forEach(callback);
    return this;
  }

  public forEachElem(callback: (value: Element, index: number, array: Element[]) => void): DOMElement {
    this.wrapped.forEach(callback);
    return this;
  }

  public filter(callback: (value: DOMElement, index: number, array: DOMElement[]) => value is DOMElement): DOMElement {
    return DOMElement.from(
      this.toArray()
        .filter(callback)
        .map(e => e.elem())
    );
  }

  public filterElem(callback: (value: Element, index: number, array: Element[]) => value is Element): Element[] {
    return this.wrapped.filter(callback);
  }

  public some(callback: (value: DOMElement, index: number, array: DOMElement[]) => boolean): boolean {
    return this.toArray().some(callback);
  }

  public someElem(callback: (value: Element, index: number, array: Element[]) => boolean): boolean {
    return this.wrapped.some(callback);
  }

  // ----------------------------------->

  public hasClass(className: string): boolean {
    return this.filterHTML().some(e => e.className.split(" ").some(c => c === className));
  }

  public addClass(className: string): DOMElement {
    if (className !== null) {
      this.filterHTML().forEach(e => {
        e.className += " " + className;
      });
    }
    return this;
  }

  public removeClass(className: string): DOMElement {
    if (className !== null) {
      this.filterHTML().forEach(e => {
        e.className = e.className
          .split(" ")
          .filter(c => c !== className)
          .join(" ");
      });
    }
    return this;
  }

  public html(content: string): DOMElement {
    if (content !== null) {
      this.filterHTML().forEach(e => (e.innerHTML = content));
    }
    return this;
  }

  public text(content: string): DOMElement {
    if (content !== null) {
      this.filterHTML().forEach(e => {
        if (e instanceof HTMLInputElement) {
          e.value = content;
        } else {
          e.innerText = content;
        }
      });
    }
    return this;
  }

  public placeholder(content: string): DOMElement {
    if (content !== null) {
      this.filterHTML().forEach(e => {
        if (e instanceof HTMLInputElement) {
          e.placeholder = content;
        } else {
          e.innerText = content;
        }
      });
    }
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public listenTo(evt: AnyEvent, callback: EventListenerOrEventListenerObject): DOMElement {
    if (evt != null && callback != null) {
      this.wrapped.forEach(e => e.addEventListener(evt as string, callback));
    }
    return this;
  }

  /**
   * Update the style of each object
   * @deprecated Use styleProperty, which is cleaner.
   */
  public style(st: IDOMElementStyle): DOMElement {
    this.filterHTML().forEach(e => {
      // Cast to any as it's too annoying to try to extract valid CSS keys to make this type safe
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.keys(st).forEach(k => ((e.style as any)[k] = st[k]));
    });
    return this;
  }

  /**
   * Update the style properties of each object
   */
  public styleProperty(st: IDOMElementStyle): DOMElement {
    if (typeof CSSStyleDeclaration.prototype.setProperty === "function") {
      this.filterHTML().forEach(e => {
        Object.keys(st).forEach(k => e.style.setProperty(k, st[k]));
      });
    }
    return this;
  }

  /**
   * Update the style of each object
   */
  public styleSVG(st: { [key: string]: unknown }): DOMElement {
    this.filterSVG().forEach(e => {
      // Cast to any as it's too annoying to try to extract valid CSS keys to make this type safe
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.keys(st).forEach(k => ((e.style as any)[k] = st[k]));
    });
    return this;
  }

  /**
   * Returns a rectangle determining the position and size of the first element
   * relative to the given element
   */
  public rect(): Rectangle {
    const e = this.elem();
    if (e == null) {
      return new Rectangle(new Position(0, 0), new Dimension(0, 0));
    }

    return sizeOfElement(e);
  }

  /**
   * Returns the dimension of the first element
   */
  public dim(): Dimension {
    const e = this.elem();
    if (e === undefined) {
      return new Dimension(0, 0);
    }
    return sizeOfElement(e).dim;
  }

  /**
   * Determines whether the position of the first element is fixed
   */
  public isFixed(): boolean {
    // we're using the first element only
    let e: Element | null | undefined = this.elem();

    // first search the first html element
    while (e && !(e instanceof HTMLElement)) {
      e = e.parentElement;
    }

    if (e == null) {
      return false;
    }

    // then search the higher offset element
    // if this is the body, we're not fixed
    while (e != null) {
      if (window.getComputedStyle(e).position === "fixed") {
        return true;
      }
      e = (e as HTMLElement).offsetParent;
    }

    return false;
  }

  // ----------------------------------->

  /**
   * Insert the given element after each wrapped element
   * and return the inserted elements
   */
  public before(newElem: Element, clone: boolean): DOMElement {
    const a = this.wrapped.map(e => {
      return e.parentNode != null ? e.parentNode.insertBefore(clone ? newElem.cloneNode(true) : newElem, e) : null;
    });
    return DOMElement.from(a.filter(e => e != null));
  }

  /**
   * Append the given element at the end of each wrapped elements
   * and return the inserted elements
   */
  public append(newElem: Element, clone: boolean): DOMElement {
    const a = this.wrapped.map(e => e.appendChild(clone ? newElem.cloneNode(true) : newElem));
    return DOMElement.from(a.filter(e => e != null));
  }

  /**
   * Prepend the given element at the beginning of each wrapped elements
   * and return the inserted elements
   */
  public prepend(newElem: Element, clone: boolean): DOMElement {
    const a = this.wrapped.map(e => {
      const ne: Element = clone ? (newElem.cloneNode(true) as Element) : newElem;

      if (typeof e.prepend === "function") {
        e.prepend(ne);
      } else {
        const docFrag = document.createDocumentFragment();
        docFrag.appendChild(ne instanceof Node ? ne : document.createTextNode(String(ne)));

        e.insertBefore(docFrag, e.firstChild);
      }

      return ne;
    });
    return DOMElement.from(a.filter(e => e != null));
  }

  // ----------------------------------->

  /**
   * Flattern an array of iterable (Array, HTMLCollection, NodeList)
   * into an array of Element
   */
  public static flattern<T extends Element>(a: ArrayLike<T>[]): T[] {
    if (a.length === 0) {
      return [];
    }
    return a.reduce<T[]>((acc, val) => {
      return acc.concat(Array.from(val));
    }, []);
  }

  /**
   * Creates a DOM Element from the given element, that can be type of :
   * - a string describing a selector (querySelectAll)
   * - an Element
   * - a NodeList, Array, HTMLCollection of Element
   * - a DOMElement (return self)
   */
  public static from(ne?: unknown): DOMElement {
    if (ne == null) {
      return DOMElement.EMPTY;
    }

    const e: unknown = ne;

    if (typeof e === "string") {
      return DOMElement.from(document.querySelectorAll(e));
    }

    if (typeof e === "object") {
      if (e instanceof Array || e instanceof NodeList) {
        const elements: Element[] = [];
        // NodeList is not iterable with for-of
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < e.length; i++) {
          const node = e[i];
          if (node instanceof Element) {
            elements.push(node);
          }
        }
        return new DOMElement(elements);
      }
      // noinspection SuspiciousTypeOfGuard
      if (e instanceof DOMElement) {
        return e;
      }
      if (e instanceof Element) {
        return new DOMElement([e]);
      }
      if (e instanceof HTMLCollection) {
        return new DOMElement(Array.from(e));
      }
    }

    // eslint-disable-next-line no-use-before-define
    return DOMElement.EMPTY;
  }
}

/**
 * Wrap the given argumens into one DOMElement
 */
export function dom(...args: unknown[]): DOMElement {
  // optimize one or none
  if (args.length === 0) {
    return DOMElement.EMPTY;
  } else if (args.length === 1) {
    return DOMElement.from(args[0]);
  }

  let d: DOMElement = DOMElement.EMPTY;
  args.forEach(e => (d = d.concat(DOMElement.from(e))));

  return d;
}

/**
 * Accessors from the document (that is not an Element)
 */
export const doc = {
  getById: (id: string): DOMElement => {
    return dom(document.getElementById(id));
  },

  getByTag: (tag: string): DOMElement => {
    return dom(document.getElementsByTagName(tag));
  },

  getByClass: (className: string): DOMElement => {
    return dom(document.getElementsByClassName(className));
  },

  selectOne: (selector: string): DOMElement => {
    return dom(document.querySelector(selector));
  },

  select: (selector: string): DOMElement => {
    return dom(document.querySelectorAll(selector));
  },

  body: (): DOMElement => {
    return dom(document.body);
  },
};
