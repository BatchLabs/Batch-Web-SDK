import { Consts } from "com.batch.shared/constants/user";

export function exceedsMaxPayloadSize(serialized: string): boolean {
  return new Blob([serialized]).size > Consts.MaxPayloadSizeBytes;
}
