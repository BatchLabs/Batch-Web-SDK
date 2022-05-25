export default function deepClone<T>(src: T): T {
  const source: unknown = src; // Type erasure

  if (typeof source !== "object") {
    return source as T;
  }

  if (source == null) {
    return null as unknown as T;
  }

  if (source instanceof Date) {
    return new Date(source) as unknown as T;
  }

  if (source instanceof Array) {
    const outArray = [];
    for (let i = 0; i < source.length; i++) {
      outArray[i] = deepClone(source[i]);
    }
    return outArray as unknown as T;
  }

  if (source instanceof Set) {
    const outSet = new Set();
    source.forEach(elem => {
      outSet.add(deepClone(elem));
    });
    return outSet as unknown as T;
  }

  if (source instanceof Object) {
    const outObject: { [key: string]: unknown } = {};
    for (const prop in source) {
      if (Object.prototype.hasOwnProperty.call(source, prop)) {
        outObject[prop] = deepClone((source as Record<string, unknown>)[prop]);
      }
    }
    return outObject as unknown as T;
  }

  return source;
}
