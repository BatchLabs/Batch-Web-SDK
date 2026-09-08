import { expect, it, describe } from "@jest/globals";
import Event from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import { ISerializableEvent } from "com.batch.shared/event/serializable-event";

import { ProfileIdentifyDeduplicator } from "../profile-identify-deduplicator";

// --------------- helpers ---------------

function identifyEvent(customId: string | null): Event {
  const params =
    customId !== null ? { identifiers: { install_id: "install-1", custom_id: customId } } : { identifiers: { install_id: "install-1" } };
  return new Event(InternalSDKEvent.ProfileIdentify, params);
}

function otherEvent(name: InternalSDKEvent): Event {
  return new Event(name, {});
}

// --------------- extractCustomId ---------------

describe("extractCustomId", () => {
  it("returns null for null params", () => {
    expect(ProfileIdentifyDeduplicator.extractCustomId(null)).toBeNull();
  });

  it("returns null for non-object params", () => {
    expect(ProfileIdentifyDeduplicator.extractCustomId("not-an-object")).toBeNull();
    expect(ProfileIdentifyDeduplicator.extractCustomId(42)).toBeNull();
  });

  it("returns null when identifiers is missing", () => {
    expect(ProfileIdentifyDeduplicator.extractCustomId({ foo: "bar" })).toBeNull();
  });

  it("returns null when identifiers does not have custom_id", () => {
    expect(ProfileIdentifyDeduplicator.extractCustomId({ identifiers: { other: "value" } })).toBeNull();
  });

  it("returns null when custom_id is null", () => {
    expect(ProfileIdentifyDeduplicator.extractCustomId({ identifiers: { custom_id: null } })).toBeNull();
  });

  it("returns the custom_id string when present", () => {
    expect(ProfileIdentifyDeduplicator.extractCustomId({ identifiers: { custom_id: "user123" } })).toBe("user123");
  });

  it("returns empty string for empty custom_id", () => {
    expect(ProfileIdentifyDeduplicator.extractCustomId({ identifiers: { custom_id: "" } })).toBe("");
  });
});

// --------------- deduplicate ---------------

describe("deduplicate", () => {
  it("returns empty list for empty input", () => {
    expect(ProfileIdentifyDeduplicator.deduplicate([])).toHaveLength(0);
  });

  it("returns all events unchanged when there are no identify events", () => {
    const events: ISerializableEvent[] = [otherEvent(InternalSDKEvent.Start), otherEvent(InternalSDKEvent.InstallDataChanged)];
    const result = ProfileIdentifyDeduplicator.deduplicate(events);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe(InternalSDKEvent.Start);
    expect(result[1].name).toBe(InternalSDKEvent.InstallDataChanged);
  });

  it("keeps a single identify event unchanged", () => {
    const result = ProfileIdentifyDeduplicator.deduplicate([identifyEvent("alice")]);
    expect(result).toHaveLength(1);
  });

  it("deduplicates two consecutive identify events with the same custom_id", () => {
    const first = identifyEvent("alice");
    const second = identifyEvent("alice");
    const result = ProfileIdentifyDeduplicator.deduplicate([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(first.id);
  });

  it("keeps two consecutive identify events with different custom_ids", () => {
    const result = ProfileIdentifyDeduplicator.deduplicate([identifyEvent("alice"), identifyEvent("bob")]);
    expect(result).toHaveLength(2);
  });

  it("deduplicates three consecutive identify events with the same custom_id", () => {
    const events = [identifyEvent("alice"), identifyEvent("alice"), identifyEvent("alice")];
    const result = ProfileIdentifyDeduplicator.deduplicate(events);
    expect(result).toHaveLength(1);
  });

  it("deduplicates two consecutive null custom_ids", () => {
    const first = identifyEvent(null);
    const second = identifyEvent(null);
    const result = ProfileIdentifyDeduplicator.deduplicate([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(first.id);
  });

  it("keeps null followed by non-null custom_id", () => {
    const result = ProfileIdentifyDeduplicator.deduplicate([identifyEvent(null), identifyEvent("alice")]);
    expect(result).toHaveLength(2);
  });

  it("removes second identify with same custom_id even when a non-identify event is between them", () => {
    const first = identifyEvent("alice");
    const middle = otherEvent(InternalSDKEvent.Start);
    const second = identifyEvent("alice");
    const result = ProfileIdentifyDeduplicator.deduplicate([first, middle, second]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(first.id);
    expect(result[1].id).toBe(middle.id);
  });

  it("keeps all events when non-identify event is between two different custom_ids", () => {
    const first = identifyEvent("alice");
    const middle = otherEvent(InternalSDKEvent.Start);
    const second = identifyEvent("bob");
    const result = ProfileIdentifyDeduplicator.deduplicate([first, middle, second]);
    expect(result).toHaveLength(3);
  });

  it("keeps all three when custom_id changes and then repeats", () => {
    // alice → bob → alice: each is a distinct transition
    const events = [identifyEvent("alice"), identifyEvent("bob"), identifyEvent("alice")];
    const result = ProfileIdentifyDeduplicator.deduplicate(events);
    expect(result).toHaveLength(3);
  });

  it("does not modify the original list", () => {
    const original = [identifyEvent("alice"), identifyEvent("alice")];
    ProfileIdentifyDeduplicator.deduplicate(original);
    expect(original).toHaveLength(2);
  });
});
