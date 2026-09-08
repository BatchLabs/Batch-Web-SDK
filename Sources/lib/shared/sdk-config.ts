// Force a reference to the Public API as we can't find out why TypeScript does not want to pick it up
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../../public/types/public-api.d.ts" />

// Partial representation of the sdk configuration
import { BatchSDK } from "../../public/types/public-api";

export interface IPrivateBatchSDKConfiguration extends BatchSDK.ISDKConfiguration {
  internal?: IBatchSDKInternalConfiguration;
  internalTransient?: IBatchSDKInternalTransientConfiguration;
  // Push settings flattened from the public `push` object at setup().
  vapidPublicKey?: string;
  serviceWorker?: BatchSDK.ISDKServiceWorkerConfiguration;
  smallIcon?: string;
  defaultIcon?: string;
  // Push activation, normalized from `push` at setup().
  pushEnabled?: boolean;
}

export interface IBatchSDKInternalConfiguration {
  origin?: string | null;
  referrer?: string;
}

// Transient config should not be persisted (usually for not persistable stuff)
export interface IBatchSDKInternalTransientConfiguration {
  serviceWorkerRegistrationPromise?: Promise<ServiceWorkerRegistration>;
}
