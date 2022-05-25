const hasNativeReplace = typeof DOMTokenList.prototype.replace === "function";

function compatReplaceClass(list: DOMTokenList, original: string, replacement: string): void {
  if (hasNativeReplace) {
    list.replace(original, replacement);
  } else if (list.contains(original)) {
    list.remove(original);
    list.add(replacement);
  }
}

/**
 * Update the classnames of the childs of the given element
 * with the mapping map of styles
 */
/* tslint:disable:prefer-for-of */
export default function updateClassNames(elem: Element, style: Record<string, string>): void {
  const children = elem.children;

  for (let i = 0; i < children.length; i++) {
    const node = children.item(i);

    // update the class name if available
    if (node) {
      if (node.classList) {
        const classList = node.classList;
        // Copy the classList. DOMTokenList.replace will not break the array walk, but .remove/.add will.
        const classNamesCopy = [];
        for (let j = 0; j < classList.length; j++) {
          classNamesCopy.push(classList[j]);
        }

        for (let j = 0; j < classNamesCopy.length; j++) {
          const origClass = classNamesCopy[j];
          if (origClass in style) {
            compatReplaceClass(classList, origClass, style[origClass]);
          }
        }
      }

      // recursive call
      updateClassNames(node, style);
    }
  }
}
