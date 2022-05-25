import type { BatchSDK } from "public/types/public-api";

// Partial representation of the sdk configuration
export interface IPrivateBatchSDKConfiguration extends BatchSDK.ISDKConfiguration {
  internal?: IBatchSDKInternalConfiguration;
}

export interface IBatchSDKInternalConfiguration {
  origin?: string | null;
  referrer?: string;
}
