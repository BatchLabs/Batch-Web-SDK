// Force a reference to the Public API as we can't find out why TypeScript does not want to pick it up
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../public/types/public-api.d.ts" />

// Partial representation of the sdk configuration
import { BatchSDK } from "../../public/types/public-api";

export interface IPrivateBatchSDKConfiguration extends BatchSDK.ISDKConfiguration {
  internal?: IBatchSDKInternalConfiguration;
  internalTransient?: IBatchSDKInternalTransientConfiguration;
}

export interface IBatchSDKInternalConfiguration {
  origin?: string | null;
  referrer?: string;
}

// Transient config should not be persisted (usually for not persistable stuff)
export interface IBatchSDKInternalTransientConfiguration {
  serviceWorkerRegistrationPromise?: Promise<ServiceWorkerRegistration>;
}
