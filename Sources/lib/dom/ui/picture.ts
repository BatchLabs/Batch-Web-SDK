function makeSourceElement(srcset: string, mimetype?: string): HTMLSourceElement {
  const elem = document.createElement("source");
  if (mimetype) {
    elem.type = mimetype;
  }
  elem.srcset = srcset;
  return elem;
}

function makeSrcset(basePath: string, extension: string, enableRetina: boolean): string {
  const srcset = enableRetina ? basePath + "@2x." + extension + " 2x," : "";
  return srcset + basePath + "." + extension + " 1x";
}

/**
 * Make a <picture> children
 *
 * Files are expected to be named:
 * <basepath>.png
 * <basepath>@2x.png
 * <basepath>.webp
 * <basepath>@2x.webp
 *
 * Note: this does not return the picture element itself.
 */
export function makePictureElementContents(basePath: string, enableWebp: boolean, enableRetina: boolean): HTMLElement[] {
  const elements: HTMLElement[] = [];

  if (enableWebp) {
    elements.push(makeSourceElement(makeSrcset(basePath, "webp", enableRetina), "image/webp"));
  }

  elements.push(makeSourceElement(makeSrcset(basePath, "png", enableRetina)));

  const imgFallback = document.createElement("img");
  imgFallback.src = basePath + "." + "png";
  elements.push(imgFallback);
  return elements;
}

export function fillPictureElement(el: HTMLPictureElement, basePath: string, enableWebp: boolean, enableRetina: boolean): void {
  makePictureElementContents(basePath, enableWebp, enableRetina).forEach(e => {
    el.appendChild(e);
  });
}
