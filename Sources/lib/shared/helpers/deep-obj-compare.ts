//TODO (opensource): We need our own version of this, as we can't source where we got this or its license
// It probably was https://github.com/substack/node-deep-equal

// This file will use "any" as it's highly dynamic
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Determines whether the given value is null or undefined
 */
const isNull = (value?: any): boolean => value === null || value === undefined;

/**
 * Detemrines whether the given value is a buffer (array ?)
 */
const isBuffer = (value?: any): boolean => {
  if (!value || typeof value !== "object" || typeof value.length !== "number") {
    return false;
  }

  if (typeof value.copy !== "function" || typeof value.slice !== "function") {
    return false;
  }

  return !(value.length > 0 && typeof value[0] !== "number");
};

// ----------------------------------->

const deepEqual = (actual?: any, expected?: any): boolean => {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  }

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  if (!actual || !expected || (typeof actual !== "object" && typeof expected !== "object")) {
    return actual === expected;
  }

  /**
   * Object comparison
   */

  if (isNull(actual) || isNull(expected)) {
    return false;
  }

  // an identical 'prototype' property.
  if (actual.prototype !== expected.prototype) {
    return false;
  }

  // buffer
  if (isBuffer(actual)) {
    if (!isBuffer(expected) || actual.length !== expected.length) {
      return false;
    }

    // compare values
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compare object keys
   */

  if (typeof actual !== typeof expected) {
    return false;
  }

  let ka;
  let kb;

  try {
    ka = Object.keys(actual);
    kb = Object.keys(expected);
  } catch (e) {
    // happens when one is a string literal and the other isn't
    return false;
  }

  if (ka.length !== kb.length) {
    return false;
  }

  // cheap key test
  for (let i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i]) {
      return false;
    }
  }

  // equivalent values for every corresponding key, and
  // possibly expensive deep test
  for (let i = ka.length - 1; i >= 0; i--) {
    const key = ka[i];
    if (!deepEqual(actual[key], expected[key])) {
      return false;
    }
  }

  return true;
};

export default deepEqual;
