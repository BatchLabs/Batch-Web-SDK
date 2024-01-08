import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { isSet } from "com.batch.shared/helpers/primitive";
import { ProfileCustomDataAttributes, ProfileDataAttribute } from "com.batch.shared/profile/profile-data-types";

type AttributesDiffResult = {
  added: ProfileCustomDataAttributes;
  removed: ProfileCustomDataAttributes;
};

const areSetsEqual = (a: Set<string>, b: Set<string>): boolean => a.size === b.size && Array.from(a).every(value => b.has(value));

function areAttributesEqual(first?: ProfileDataAttribute, second?: ProfileDataAttribute): boolean {
  if (first === second) {
    return true;
  }

  // first & second both being undefined is handled by first === second
  if (first === undefined || second === undefined) {
    return false;
  }

  if (first.type !== second.type) {
    return false;
  }

  if (first.value !== second.value) {
    if (isSet(first.value) && isSet(second.value)) {
      return areSetsEqual(first.value, second.value);
    }
    return false;
  }

  return true;
}

function diffAttributes(oldAttributes: ProfileCustomDataAttributes, newAttributes: ProfileCustomDataAttributes): AttributesDiffResult {
  // Copy old attributes in "removed".
  // Iterate on new attributes, remove them from "removed" if they're the same.
  // Add them in "added" if they're missing or different.
  // That way, any attribute that is missing will automatically be in "removed".
  // An updated attribute shows up in both added and removed.
  const result: AttributesDiffResult = { added: {}, removed: deepClone(oldAttributes) };

  for (const [name, newAttributeValue] of Object.entries(newAttributes)) {
    const oldAttributeValue = oldAttributes[name];
    if (areAttributesEqual(oldAttributeValue, newAttributeValue)) {
      delete result.removed[name];
    } else {
      result.added[name] = Object.assign({}, newAttributeValue);
    }
  }

  return result;
}

// Utility method to compute the diff between two sets of attributes and two sets of tag collections
// Note: this method computes the _full_ diff to match what's done on the mobile SDKs, but the result isn't
// yet sent to the server
export function hasProfileDataChanged(oldAttributes: ProfileCustomDataAttributes, newAttributes: ProfileCustomDataAttributes): boolean {
  const attributesDiff = diffAttributes(oldAttributes, newAttributes);

  return Object.keys(attributesDiff.added).length > 0 || Object.keys(attributesDiff.removed).length > 0;
}
