import deepClone from "com.batch.shared/helpers/object-deep-clone";

import { UserDataAttribute, UserDataAttributes, UserDataTagCollections } from "./user-data-writer";

type AttributesDiffResult = {
  added: UserDataAttributes;
  removed: UserDataAttributes;
};

type TagsDiffResult = {
  added: UserDataTagCollections;
  removed: UserDataTagCollections;
};

type TagCollectionDiffResult = {
  added: Set<string>;
  removed: Set<string>;
};

function areAttributesEqual(first?: UserDataAttribute, second?: UserDataAttribute): boolean {
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
    return false;
  }

  return true;
}

function diffAttributes(oldAttributes: UserDataAttributes, newAttributes: UserDataAttributes): AttributesDiffResult {
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

function diffTagCollection(oldTags: Set<string>, newTags: Set<string>): TagCollectionDiffResult {
  const result: TagCollectionDiffResult = { added: new Set(), removed: new Set() };

  // Optimize common cases
  if (newTags.size === 0) {
    if (oldTags.size === 0) {
      // Nothing changed
      return result;
    } else {
      // No new tag, remove all old tags, no need to compare them all
      result.removed = oldTags;
      return result;
    }
  } else if (oldTags.size === 0) {
    // We've got new tags, but no old tags, no need to compare
    result.added = newTags;
    return result;
  }

  // No fast path, compare all tags.
  // Use a similar technique to diffAttributes (see that method for more info).
  const removedTags = new Set(oldTags);
  const addedTags: Set<string> = new Set();

  newTags.forEach(newTag => {
    if (!removedTags.delete(newTag)) {
      // Tag wasn't in the old tags, it's new
      addedTags.add(newTag);
    }
  });

  result.added = addedTags;
  result.removed = removedTags;

  return result;
}

function diffTags(oldTags: UserDataTagCollections, newTags: UserDataTagCollections): TagsDiffResult {
  const result: TagsDiffResult = { added: {}, removed: deepClone(oldTags) };

  for (const [name, newTagCollection] of Object.entries(newTags)) {
    // TS doesn't warn about this being possibly undefined, but we need to handle it.
    // FIXME: enable --noUncheckedIndexedAccess
    const oldTagCollection = result.removed[name] ?? [];
    const collectionDiff = diffTagCollection(oldTagCollection, newTagCollection);

    if (collectionDiff.added.size > 0) {
      result.added[name] = collectionDiff.added;
    }

    if (collectionDiff.removed.size > 0) {
      result.removed[name] = collectionDiff.removed;
    } else {
      delete result.removed[name];
    }
  }

  return result;
}

// Utility method to compute the diff between two sets of attributes and two sets of tag collections
// Note: this method computes the _full_ diff to match what's done on the mobile SDKs, but the result isn't
// yet sent to the server
export function hasUserDataChanged(
  oldAttributes: UserDataAttributes,
  oldTags: UserDataTagCollections,
  newAttributes: UserDataAttributes,
  newTags: UserDataTagCollections
): boolean {
  const attributesDiff = diffAttributes(oldAttributes, newAttributes);
  const tagsDiff = diffTags(oldTags, newTags);

  return (
    Object.keys(attributesDiff.added).length > 0 ||
    Object.keys(attributesDiff.removed).length > 0 ||
    Object.keys(tagsDiff.added).length > 0 ||
    Object.keys(tagsDiff.removed).length > 0
  );
}
