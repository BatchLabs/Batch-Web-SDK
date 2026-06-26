import { Log } from "com.batch.shared/logger";

import { InternalSDKEvent } from "./event-names";
import { ISerializableEvent } from "./serializable-event";

const TAG = "ProfileIdentifyDeduplicator";

/**
 * Removes duplicate consecutive _PROFILE_IDENTIFY events that carry the same
 * custom_id from an event list.
 *
 * Non-identify events pass through unchanged and do not reset deduplication tracking,
 * so two identify events with the same custom_id are always collapsed even when other
 * event types appear between them.
 */
export class ProfileIdentifyDeduplicator {
  private constructor() {}

  public static deduplicate(events: ISerializableEvent[]): ISerializableEvent[] {
    const result: ISerializableEvent[] = [];
    let hasSeenIdentify = false;
    let lastCustomId: string | null = null;

    for (const event of events) {
      if (event.name === InternalSDKEvent.ProfileIdentify) {
        const json = event.toJSON();
        const params = json !== null && typeof json === "object" ? (json as Record<string, unknown>)["params"] : null;
        const currentCustomId = ProfileIdentifyDeduplicator.extractCustomId(params ?? null);
        if (hasSeenIdentify && currentCustomId === lastCustomId) {
          Log.debug(TAG, `Deduplicating consecutive _PROFILE_IDENTIFY event with custom_id: ${currentCustomId}`);
          continue;
        }
        hasSeenIdentify = true;
        lastCustomId = currentCustomId;
      }
      result.push(event);
    }

    return result;
  }

  /**
   * Extracts the custom_id value from a _PROFILE_IDENTIFY event's params object.
   * Returns null when the identifier is absent, explicitly null, or the structure is unexpected.
   */
  public static extractCustomId(params: unknown): string | null {
    if (params === null || typeof params !== "object") {
      return null;
    }
    const identifiers = (params as Record<string, unknown>)["identifiers"];
    if (identifiers === null || typeof identifiers !== "object") {
      return null;
    }
    const customId = (identifiers as Record<string, unknown>)["custom_id"];
    if (typeof customId === "string") {
      return customId;
    }
    return null;
  }
}
